import type { ObjectId } from "mongodb";

export type Doc = {
  _id?: ObjectId | string;
  url: string;
  canonical_url?: string;
  dedupe_key?: string;
  domain?: string;
  title?: string;
  title_source?: "metadata" | "manual";
  user_id: string;
  created_at: Date | string;
  updated_at?: Date | string;
  read?: boolean;
  read_at?: Date | string | null;
  metadata_status?: "pending" | "complete" | "failed";
  metadata_attempted_at?: Date | string | null;
  metadata_error?: string | null;
  deleted_at?: Date | string | null;
  merged_from_ids?: string[];
};

export type DocWithId = Doc & {
  _id: ObjectId | string;
};

export type ApiDoc = {
  id: string;
  url: string;
  domain: string;
  title?: string;
  title_source?: "metadata" | "manual";
  created_at: string;
  read: boolean;
  read_at: string | null;
  metadata_status: "pending" | "complete" | "failed";
  metadata_error: string | null;
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
  domain:
    doc.domain ??
    (() => {
      try {
        return new URL(doc.url).hostname.replace(/^www\./, "");
      } catch {
        return doc.url;
      }
    })(),
  title: doc.title,
  title_source: doc.title_source,
  created_at: normalizeCreatedAt(doc.created_at),
  read: doc.read ?? false,
  read_at: doc.read_at ? normalizeCreatedAt(doc.read_at) : null,
  metadata_status:
    doc.metadata_status ?? (doc.title?.trim() ? "complete" : "failed"),
  metadata_error: doc.metadata_error ?? null,
});
