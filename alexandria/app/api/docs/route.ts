import { NextResponse } from "next/server";
import {
  ObjectId,
  type Collection,
  type Filter,
  type UpdateFilter,
} from "mongodb";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { getDb } from "@/lib/mongo";
import { authOptions } from "@/lib/auth";
import { toApiDoc, type Doc, type DocWithId } from "@/lib/docsSchema";
import { gatherDocMetadata } from "@/lib/docMetadata";
import { stripUrlArguments } from "@/lib/url";

export const runtime = "nodejs";
const collectionName = "docs";
const METADATA_REFRESH_CONCURRENCY = 4;

const getUrlFromBody = (body: unknown) =>
  typeof (body as { url?: unknown })?.url === "string"
    ? stripUrlArguments((body as { url: string }).url)
    : "";

const isValidUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const badRequest = (message: string) =>
  NextResponse.json({ error: message }, { status: 400 });

const unauthorized = (message = "Not authenticated.") =>
  NextResponse.json({ error: message }, { status: 401 });

const internalError = (message = "Internal server error.") =>
  NextResponse.json({ error: message }, { status: 500 });

const coerceId = (id: string) => {
  if (/^[a-f0-9]{24}$/i.test(id)) {
    return new ObjectId(id);
  }
  return id;
};

const getUserId = (session: Session | null) => {
  const userId = (session?.user as { id?: string } | undefined)?.id;
  return userId && userId.trim().length > 0 ? userId : null;
};

const normalizeDocTitle = (value: string | null | undefined) => {
  const title = typeof value === "string" ? value.trim() : "";
  return title.length > 0 ? title : undefined;
};

const resolveDocTitle = async (url: string) => {
  const metadata = await gatherDocMetadata(url);
  return normalizeDocTitle(metadata.title);
};

type TitleUpdate = {
  title: string | undefined;
  update: UpdateFilter<Doc> | null;
};

const buildTitleUpdate = async (
  url: string,
  currentTitle?: string,
): Promise<TitleUpdate> => {
  const normalizedCurrentTitle = normalizeDocTitle(currentTitle);
  const refreshedTitle = await resolveDocTitle(url);

  if (normalizedCurrentTitle === refreshedTitle) {
    return { title: refreshedTitle, update: null };
  }

  if (refreshedTitle) {
    return {
      title: refreshedTitle,
      update: { $set: { title: refreshedTitle } },
    };
  }

  if (normalizedCurrentTitle) {
    return {
      title: undefined,
      update: { $unset: { title: "" } },
    };
  }

  return { title: undefined, update: null };
};

const runWithConcurrencyLimit = async <T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) => {
  if (items.length === 0) {
    return;
  }

  let index = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);
  const runners = Array.from({ length: workerCount }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      await worker(items[currentIndex]);
    }
  });

  await Promise.all(runners);
};

const refreshDocMetadata = async (
  collection: Collection<Doc>,
  userId: string,
  doc: DocWithId,
) => {
  try {
    const titleUpdate = await buildTitleUpdate(doc.url, doc.title);
    if (!titleUpdate.update) {
      return false;
    }

    const filter = { _id: doc._id, user_id: userId } as Filter<Doc>;
    await collection.updateOne(filter, titleUpdate.update);
    return true;
  } catch (error) {
    console.error("Metadata refresh failed for document.", {
      userId,
      docId: doc._id.toString(),
      url: doc.url,
      error,
    });
    return false;
  }
};

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) {
    return unauthorized("User identity is missing.");
  }
  const db = await getDb();
  const collection = db.collection<Doc>(collectionName);
  const docs = (await collection
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray()) as DocWithId[];

  return NextResponse.json({
    docs: docs.map((doc) => toApiDoc(doc)),
  });
}

export async function PUT() {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) {
    return unauthorized("User identity is missing.");
  }

  const db = await getDb();
  const collection = db.collection<Doc>(collectionName);
  const docs = (await collection
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray()) as DocWithId[];
  let updatedCount = 0;

  await runWithConcurrencyLimit(docs, METADATA_REFRESH_CONCURRENCY, async (doc) => {
    const updated = await refreshDocMetadata(collection, userId, doc);
    if (updated) {
      updatedCount += 1;
    }
  });

  return NextResponse.json({
    ok: true,
    totalCount: docs.length,
    updatedCount,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) {
    return unauthorized("User identity is missing.");
  }
  const body = await request.json().catch(() => null);
  const url = getUrlFromBody(body);

  if (!url) {
    return badRequest("URL is required.");
  }

  if (!isValidUrl(url)) {
    return badRequest("Invalid URL.");
  }

  const db = await getDb();
  const collection = db.collection<Doc>(collectionName);
  let title: string | undefined;
  try {
    title = (await buildTitleUpdate(url)).title;
  } catch {
    return internalError("Could not fetch document metadata.");
  }
  const createdAt = new Date();
  const doc: Doc = {
    url,
    title,
    user_id: userId,
    created_at: createdAt,
    read: false,
    read_at: null,
  };

  const result = await collection.insertOne(doc);

  return NextResponse.json({
    doc: toApiDoc({
      _id: result.insertedId,
      ...doc,
    } as DocWithId),
  });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) {
    return unauthorized("User identity is missing.");
  }
  const body = await request.json().catch(() => null);
  const url = getUrlFromBody(body);

  if (!url) {
    return badRequest("URL is required.");
  }

  const db = await getDb();
  const collection = db.collection<Doc>(collectionName);
  const result = await collection.deleteOne({
    url,
    user_id: userId,
  } as Filter<Doc>);

  if (!result.deletedCount) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) {
    return unauthorized("User identity is missing.");
  }
  const body = await request.json().catch(() => null);
  const id =
    typeof (body as { id?: unknown })?.id === "string"
      ? (body as { id: string }).id.trim()
      : "";
  const read =
    typeof (body as { read?: unknown })?.read === "boolean"
      ? (body as { read: boolean }).read
      : null;

  if (!id) {
    return badRequest("Document id is required.");
  }
  if (read === null) {
    return badRequest("Read state is required.");
  }

  const db = await getDb();
  const collection = db.collection<Doc>(collectionName);
  const result = await collection.updateOne(
    { _id: coerceId(id), user_id: userId } as Filter<Doc>,
    {
      $set: {
        read,
        read_at: read ? new Date() : null,
      },
    },
  );

  if (!result.matchedCount) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
