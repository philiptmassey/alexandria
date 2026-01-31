import { NextResponse } from "next/server";
import { ObjectId, type Filter } from "mongodb";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { getDb } from "@/lib/mongo";
import { authOptions } from "@/lib/auth";
import { toApiDoc, type Doc, type DocWithId } from "@/lib/docsSchema";
import { gatherDocMetadata } from "@/lib/docMetadata";
import type { DocMetadata } from "@/lib/docMetadata";

export const runtime = "nodejs";
const collectionName = "docs";

const getUrlFromBody = (body: unknown) =>
  typeof (body as { url?: unknown })?.url === "string"
    ? (body as { url: string }).url.trim()
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

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) {
    return unauthorized("User identity is missing.");
  }
  const db = await getDb();
  const docs = await db
    .collection<Doc>(collectionName)
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray();

  return NextResponse.json({
    docs: docs.map((doc) => toApiDoc(doc as DocWithId)),
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
  let metadata: DocMetadata;
  try {
    metadata = await gatherDocMetadata(url);
  } catch {
    return internalError("Could not fetch document metadata.");
  }
  const title = typeof metadata.title === "string" ? metadata.title.trim() : "";
  const createdAt = new Date();
  const doc: Doc = {
    url,
    title: title.length > 0 ? title : undefined,
    user_id: userId,
    created_at: createdAt,
    read: false,
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
    { $set: { read } },
  );

  if (!result.matchedCount) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
