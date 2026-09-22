import { after, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { MongoServerError, type Filter } from "mongodb";
import { authOptions } from "@/lib/auth";
import {
  coerceDocId,
  enrichDocMetadata,
  getDocsCollection,
  listDocs,
  type LibraryStatus,
} from "@/lib/docs";
import { toApiDoc, type Doc, type DocWithId } from "@/lib/docsSchema";
import { normalizeDocUrl } from "@/lib/url";

export const runtime = "nodejs";

const badRequest = (message: string) =>
  NextResponse.json({ error: message }, { status: 400 });

const unauthorized = (message = "Not authenticated.") =>
  NextResponse.json({ error: message }, { status: 401 });

const getUserId = (session: Session | null) => {
  const userId = (session?.user as { id?: string } | undefined)?.id;
  return userId?.trim() || null;
};

const getAuthenticatedUserId = async () =>
  getUserId(await getServerSession(authOptions));

const parseBody = async (request: Request) =>
  request.json().catch(() => null) as Promise<Record<string, unknown> | null>;

const scheduleEnrichment = (doc: DocWithId) => {
  after(() =>
    enrichDocMetadata({
      id: doc._id,
      userId: doc.user_id,
      url: doc.url,
    }),
  );
};

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorized("User identity is missing.");

  const searchParams = new URL(request.url).searchParams;
  const requestedStatus = searchParams.get("status");
  const status: LibraryStatus =
    requestedStatus === "all" || requestedStatus === "read"
      ? requestedStatus
      : "unread";
  const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const page = await listDocs({
    userId,
    status,
    query: searchParams.get("q") ?? "",
    cursor: searchParams.get("cursor"),
    limit: Number.isFinite(requestedLimit) ? requestedLimit : undefined,
  });

  return NextResponse.json(page);
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorized("User identity is missing.");

  const body = await parseBody(request);
  const value = typeof body?.url === "string" ? body.url : "";
  let normalized: ReturnType<typeof normalizeDocUrl>;
  try {
    normalized = normalizeDocUrl(value);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid URL.");
  }

  const collection = await getDocsCollection();
  const existing = (await collection.findOne({
    user_id: userId,
    $or: [
      { dedupe_key: normalized.dedupeKey },
      { url: normalized.url },
      { canonical_url: normalized.url },
    ],
  } as Filter<Doc>)) as DocWithId | null;

  if (existing) {
    if (existing.deleted_at) {
      await collection.updateOne(
        { _id: existing._id, user_id: userId } as Filter<Doc>,
        {
          $set: { read: false, read_at: null, updated_at: new Date() },
          $unset: { deleted_at: "" },
        },
      );
      existing.deleted_at = null;
      existing.read = false;
      existing.read_at = null;
    }
    if (!existing.title || existing.metadata_status === "failed") {
      scheduleEnrichment(existing);
    }
    return NextResponse.json({ doc: toApiDoc(existing), duplicate: true });
  }

  const now = new Date();
  const doc: Doc = {
    url: normalized.url,
    canonical_url: normalized.url,
    dedupe_key: normalized.dedupeKey,
    domain: normalized.domain,
    user_id: userId,
    created_at: now,
    updated_at: now,
    read: false,
    read_at: null,
    metadata_status: "pending",
    metadata_attempted_at: null,
    metadata_error: null,
    deleted_at: null,
  };

  try {
    const result = await collection.insertOne(doc);
    const created = { _id: result.insertedId, ...doc } as DocWithId;
    scheduleEnrichment(created);
    return NextResponse.json(
      { doc: toApiDoc(created), duplicate: false },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      const duplicate = (await collection.findOne({
        user_id: userId,
        dedupe_key: normalized.dedupeKey,
      } as Filter<Doc>)) as DocWithId | null;
      if (duplicate) {
        return NextResponse.json({ doc: toApiDoc(duplicate), duplicate: true });
      }
    }
    console.error("Could not save document.", { userId, url: normalized.url, error });
    return NextResponse.json(
      { error: "Could not save this document." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorized("User identity is missing.");

  const body = await parseBody(request);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) return badRequest("Document id is required.");

  const collection = await getDocsCollection();
  const filter = { _id: coerceDocId(id), user_id: userId } as Filter<Doc>;
  const now = new Date();

  if (body?.restore === true) {
    await collection.updateOne(filter, {
      $set: { updated_at: now },
      $unset: { deleted_at: "" },
    });
  } else if (typeof body?.read === "boolean") {
    await collection.updateOne(filter, {
      $set: {
        read: body.read,
        read_at: body.read ? now : null,
        updated_at: now,
      },
    });
  } else if (typeof body?.title === "string") {
    const title = body.title.replace(/\s+/g, " ").trim();
    if (!title) return badRequest("Title cannot be empty.");
    await collection.updateOne(filter, {
      $set: {
        title,
        title_source: "manual",
        metadata_status: "complete",
        metadata_error: null,
        updated_at: now,
      },
    });
  } else {
    return badRequest("No supported update was provided.");
  }

  const updated = (await collection.findOne(filter)) as DocWithId | null;
  if (!updated) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  return NextResponse.json({ doc: toApiDoc(updated) });
}

export async function DELETE(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorized("User identity is missing.");

  const body = await parseBody(request);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!id && !url) return badRequest("Document id is required.");

  const identity = id
    ? { _id: coerceDocId(id), user_id: userId }
    : { url, user_id: userId };
  const collection = await getDocsCollection();
  const result = await collection.updateOne(identity as Filter<Doc>, {
    $set: { deleted_at: new Date(), updated_at: new Date() },
  });
  if (!result.matchedCount) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

const runWithConcurrency = async <T,>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) => {
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const item = items[index];
        index += 1;
        await worker(item);
      }
    }),
  );
};

export async function PUT(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return unauthorized("User identity is missing.");

  const body = await parseBody(request);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const collection = await getDocsCollection();
  const filter: Filter<Doc> = id
    ? { _id: coerceDocId(id), user_id: userId, deleted_at: null }
    : {
        user_id: userId,
        deleted_at: null,
        $or: [
          { title: { $exists: false } },
          { title: "" },
          { metadata_status: "failed" },
        ],
      };
  const documents = (await collection.find(filter).limit(id ? 1 : 20).toArray()) as DocWithId[];
  if (id && documents.length === 0) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const ids = documents.map((document) => document._id);
  if (ids.length > 0) {
    await collection.updateMany(
      { _id: { $in: ids }, user_id: userId } as Filter<Doc>,
      {
        $set: {
          metadata_status: "pending",
          metadata_error: null,
          updated_at: new Date(),
        },
      },
    );
    after(() =>
      runWithConcurrency(documents, 4, (document) =>
        enrichDocMetadata({
          id: document._id,
          userId,
          url: document.url,
        }),
      ),
    );
  }

  return NextResponse.json({ ok: true, scheduledCount: documents.length });
}
