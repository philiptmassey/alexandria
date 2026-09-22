import {
  ObjectId,
  type Collection,
  type Filter,
  type WithId,
} from "mongodb";
import { gatherDocMetadata } from "@/lib/docMetadata";
import { getDb } from "@/lib/mongo";
import { toApiDoc, type ApiDoc, type Doc } from "@/lib/docsSchema";

export const DOCS_COLLECTION = "docs";
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export type LibraryStatus = "all" | "unread" | "read";

export type LibraryCounts = {
  all: number;
  unread: number;
  read: number;
};

export type DocsPage = {
  docs: ApiDoc[];
  nextCursor: string | null;
  counts: LibraryCounts;
};

export const getDocsCollection = async (): Promise<Collection<Doc>> => {
  const db = await getDb();
  return db.collection<Doc>(DOCS_COLLECTION);
};

export const coerceDocId = (id: string) =>
  /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : id;

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const listDocs = async ({
  userId,
  status = "unread",
  query = "",
  cursor,
  limit = DEFAULT_PAGE_SIZE,
}: {
  userId: string;
  status?: LibraryStatus;
  query?: string;
  cursor?: string | null;
  limit?: number;
}): Promise<DocsPage> => {
  const collection = await getDocsCollection();
  const safeLimit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
  const baseFilter: Filter<Doc> = { user_id: userId, deleted_at: null };
  const filter: Filter<Doc> = { ...baseFilter };

  if (status === "read") filter.read = true;
  if (status === "unread") filter.read = { $ne: true };

  const normalizedQuery = query.trim();
  if (normalizedQuery) {
    const search = new RegExp(escapeRegex(normalizedQuery), "i");
    filter.$or = [{ title: search }, { url: search }, { domain: search }];
  }

  if (cursor && /^[a-f0-9]{24}$/i.test(cursor)) {
    filter._id = { $lt: new ObjectId(cursor) } as Filter<Doc>["_id"];
  }

  const countBase = { user_id: userId, deleted_at: null } as Filter<Doc>;
  const [documents, all, unread, read] = await Promise.all([
    collection.find(filter).sort({ _id: -1 }).limit(safeLimit + 1).toArray(),
    collection.countDocuments(countBase),
    collection.countDocuments({ ...countBase, read: { $ne: true } }),
    collection.countDocuments({ ...countBase, read: true }),
  ]);

  const hasNextPage = documents.length > safeLimit;
  const page = documents.slice(0, safeLimit) as Array<WithId<Doc>>;
  return {
    docs: page.map(toApiDoc),
    nextCursor: hasNextPage ? page.at(-1)?._id.toString() ?? null : null,
    counts: { all, unread, read },
  };
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message.slice(0, 300) : "Metadata fetch failed.";

export const enrichDocMetadata = async ({
  id,
  userId,
  url,
}: {
  id: ObjectId | string;
  userId: string;
  url: string;
}) => {
  const collection = await getDocsCollection();
  const attemptedAt = new Date();
  try {
    const metadata = await gatherDocMetadata(url);
    const title = metadata.title?.trim();
    const filter = {
      _id: id,
      user_id: userId,
      title_source: { $ne: "manual" },
      deleted_at: null,
    } as Filter<Doc>;

    if (title) {
      await collection.updateOne(filter, {
        $set: {
          title,
          title_source: "metadata",
          metadata_status: "complete",
          metadata_attempted_at: attemptedAt,
          metadata_error: null,
          updated_at: attemptedAt,
        },
      });
      return;
    }

    await collection.updateOne(filter, {
      $set: {
        metadata_status: "failed",
        metadata_attempted_at: attemptedAt,
        metadata_error: "No title was found on the source page.",
        updated_at: attemptedAt,
      },
    });
  } catch (error) {
    await collection.updateOne(
      {
        _id: id,
        user_id: userId,
        title_source: { $ne: "manual" },
        deleted_at: null,
      } as Filter<Doc>,
      {
        $set: {
          metadata_status: "failed",
          metadata_attempted_at: attemptedAt,
          metadata_error: errorMessage(error),
          updated_at: attemptedAt,
        },
      },
    );
  }
};
