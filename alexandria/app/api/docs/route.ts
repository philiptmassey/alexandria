import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongo";
import { toApiDoc, type DocInsert, type DocRecord } from "@/lib/docsSchema";

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

const coerceId = (id: string) => {
  if (/^[a-f0-9]{24}$/i.test(id)) {
    return new ObjectId(id);
  }
  return id;
};

export async function GET() {
  const db = await getDb();
  const docs = await db
    .collection(collectionName)
    .find({})
    .sort({ _id: -1 })
    .toArray();

  return NextResponse.json({
    docs: docs.map((doc) => toApiDoc(doc as DocRecord)),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const url = getUrlFromBody(body);

  if (!url) {
    return badRequest("URL is required.");
  }

  if (!isValidUrl(url)) {
    return badRequest("Invalid URL.");
  }

  const db = await getDb();
  const createdAt = new Date();
  const username = "1234";
  const doc: DocInsert = {
    url,
    username,
    created_at: createdAt,
  };

  const result = await db.collection(collectionName).insertOne(doc);

  return NextResponse.json({
    doc: toApiDoc({
      _id: result.insertedId,
      ...doc,
    } as DocRecord),
  });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const id =
    typeof (body as { id?: unknown })?.id === "string"
      ? (body as { id: string }).id.trim()
      : "";

  if (!id) {
    return badRequest("Document id is required.");
  }

  const db = await getDb();
  const result = await db
    .collection(collectionName)
    .deleteOne({ _id: coerceId(id) });

  if (!result.deletedCount) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
