import type { ObjectId } from "mongodb";

export type Doc = {
  _id?: ObjectId | string;
  url: string;
  title?: string;
  user_id: string;
  created_at: Date | string;
  read?: boolean;
  read_at?: Date | string | null;
};

export type DocWithId = Doc & {
  _id: ObjectId | string;
};

export type ApiDoc = {
  id: string;
  url: string;
  title?: string;
  created_at: string;
  read: boolean;
  read_at: string | null;
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

export const toApiDoc = (doc: DocWithId): ApiDoc => ({
  id: doc._id.toString(),
  url: doc.url,
  title: doc.title,
  created_at: normalizeCreatedAt(doc.created_at),
  read: doc.read ?? false,
  read_at: doc.read_at ? normalizeCreatedAt(doc.read_at) : null,
});
