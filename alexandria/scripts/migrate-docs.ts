import { MongoClient, type WithId } from "mongodb";
import type { Doc } from "../lib/docsSchema";
import { normalizeDocUrl } from "../lib/url";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const backup = args.has("--backup");
const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB ?? "alexandria";

if (!uri) {
  throw new Error("MONGODB_URI is required. The migration never uses the local fallback URI.");
}
if (apply && !backup) {
  throw new Error("Apply mode requires --backup. Run: pnpm migrate:docs -- --apply --backup");
}

const toTime = (value: Date | string | null | undefined, fallback: number) => {
  if (!value) return fallback;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? fallback : time;
};

const bestTitle = (documents: Array<WithId<Doc>>) => {
  const manual = documents.filter(
    (document) => document.title_source === "manual" && document.title?.trim(),
  );
  return (manual.length > 0 ? manual : documents)
    .map((document) => document.title?.replace(/\s+/g, " ").trim())
    .filter((title): title is string => Boolean(title))
    .sort((first, second) => second.length - first.length)[0];
};

const client = new MongoClient(uri);
await client.connect();

try {
  const db = client.db(databaseName);
  const collection = db.collection<Doc>("docs");
  const documents = (await collection.find({}).toArray()) as Array<WithId<Doc>>;
  const invalid: Array<WithId<Doc>> = [];
  const groups = new Map<string, Array<{ document: WithId<Doc>; normalized: ReturnType<typeof normalizeDocUrl> }>>();

  for (const document of documents) {
    try {
      const normalized = normalizeDocUrl(document.url);
      const key = `${document.user_id}\u0000${normalized.dedupeKey}`;
      const group = groups.get(key) ?? [];
      group.push({ document, normalized });
      groups.set(key, group);
    } catch {
      invalid.push(document);
    }
  }

  const duplicateGroups = Array.from(groups.values()).filter((group) => group.length > 1);
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Documents: ${documents.length}`);
  console.log(`Normalized identities: ${groups.size}`);
  console.log(`Duplicate groups: ${duplicateGroups.length}`);
  console.log(`Invalid URLs left unchanged: ${invalid.length}`);

  for (const group of duplicateGroups) {
    console.log("\nDuplicate group:");
    for (const { document } of group) {
      console.log(`  ${document._id.toString()}  ${document.url}`);
    }
  }

  if (!apply) {
    console.log("\nNo data was changed. Re-run with --apply --backup after reviewing this report.");
    process.exitCode = 0;
  } else {
    const backupName = `docs_backup_${new Date().toISOString().replace(/[-:.TZ]/g, "")}`;
    if (documents.length > 0) {
      await db
        .collection<Record<string, unknown>>(backupName)
        .insertMany(documents as unknown as Array<Record<string, unknown>>);
    } else {
      await db.createCollection(backupName);
    }
    console.log(`\nBackup created: ${backupName}`);

    for (const group of groups.values()) {
      const sorted = [...group].sort(
        (first, second) =>
          toTime(first.document.created_at, Number.MAX_SAFE_INTEGER) -
          toTime(second.document.created_at, Number.MAX_SAFE_INTEGER),
      );
      const active = sorted.filter(({ document }) => !document.deleted_at);
      const survivor = active[0] ?? sorted[0];
      const duplicates = sorted
        .filter(({ document }) => document._id.toString() !== survivor.document._id.toString())
        .map(({ document }) => document);
      const readDocuments = sorted
        .map(({ document }) => document)
        .filter((document) => document.read);
      const latestReadAt = readDocuments
        .map((document) => document.read_at)
        .filter((value): value is Date | string => Boolean(value))
        .sort((first, second) => toTime(second, 0) - toTime(first, 0))[0] ?? null;
      const title = bestTitle(sorted.map(({ document }) => document));
      const hasManualTitle = sorted.some(
        ({ document }) => document.title_source === "manual" && document.title?.trim(),
      );
      const createdAt = new Date(
        Math.min(...sorted.map(({ document }) => toTime(document.created_at, Date.now()))),
      );

      await collection.updateOne(
        { _id: survivor.document._id },
        {
          $set: {
            url: survivor.normalized.url,
            canonical_url: survivor.normalized.url,
            dedupe_key: survivor.normalized.dedupeKey,
            domain: survivor.normalized.domain,
            created_at: createdAt,
            updated_at: new Date(),
            read: readDocuments.length > 0,
            read_at: latestReadAt,
            deleted_at:
              active.length > 0
                ? null
                : sorted
                    .map(({ document }) => document.deleted_at)
                    .filter((value): value is Date | string => Boolean(value))
                    .sort((first, second) => toTime(second, 0) - toTime(first, 0))[0] ?? null,
            metadata_status: title ? "complete" : "failed",
            metadata_error: title ? null : survivor.document.metadata_error ?? null,
            ...(title
              ? { title, title_source: hasManualTitle ? "manual" : "metadata" }
              : {}),
            ...(duplicates.length > 0
              ? { merged_from_ids: duplicates.map((document) => document._id.toString()) }
              : {}),
          },
        },
      );

      if (duplicates.length > 0) {
        await collection.deleteMany({
          _id: { $in: duplicates.map((document) => document._id) },
        });
      }
    }

    await collection.createIndex(
      { user_id: 1, dedupe_key: 1 },
      {
        name: "unique_user_document_identity",
        unique: true,
        partialFilterExpression: { dedupe_key: { $type: "string" } },
      },
    );
    await collection.createIndex(
      { user_id: 1, deleted_at: 1, _id: -1 },
      { name: "library_listing" },
    );

    console.log(`Migration complete. ${duplicateGroups.length} duplicate groups merged.`);
  }
} finally {
  await client.close();
}
