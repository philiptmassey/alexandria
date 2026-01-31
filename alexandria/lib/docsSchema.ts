import type { ObjectId } from "mongodb";

export type DocInsert = {
  url: string;
  username: string;
  created_at: Date;
};

export type DocRecord = {
  _id: ObjectId | string;
  url: string;
  username: string;
  created_at: Date | string;
};

export type ApiDoc = {
  id: string;
  url: string;
  username: string;
  created_at: string;
};

export const normalizeCreatedAt = (value: Date | string) => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
};

export const toApiDoc = (doc: DocRecord): ApiDoc => ({
  id: doc._id.toString(),
  url: doc.url,
  username: doc.username,
  created_at: normalizeCreatedAt(doc.created_at),
});
