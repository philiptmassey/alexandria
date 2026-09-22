# Alexandria

A quiet personal library for academic papers, essays, and articles. Alexandria
keeps an unread queue, remembers completed reading, and enriches saved URLs with
titles and source metadata.

## Features

- Fast URL capture from the web app or existing Chrome extension.
- Atomic duplicate protection after the database migration.
- URL cleanup that removes tracking parameters without discarding meaningful
  query parameters.
- Equivalent arXiv and DOI links share one document identity.
- Background title enrichment with arXiv, Crossref, HTML, and PDF fallbacks.
- Manual title editing when a source blocks metadata access.
- Unread, recently read, and complete-library views with search and pagination.
- Recoverable deletion with an undo action.
- Optional Google account allowlist.

## Stack

- Next.js App Router and React
- NextAuth with Google
- MongoDB
- Vitest
- Vercel deployment

## Local setup

Requirements:

- Node.js 24
- pnpm 10.28.2
- MongoDB locally or through Atlas

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Then open <http://localhost:3000>.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection URI. |
| `MONGODB_DB` | No | Database name; defaults to `alexandria`. |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret. |
| `NEXTAUTH_SECRET` | Yes | NextAuth signing secret. |
| `NEXTAUTH_URL` | Production | Public deployment URL. |
| `AUTHORIZED_EMAILS` | No | Comma-separated Google email allowlist. Empty permits any Google account. |

## Existing-data migration

The migration backfills normalized URLs, domains, and deduplication keys. It
also reports duplicate groups and creates the indexes used by the application.
It is deliberately dry-run-only by default.

```bash
# Report only; performs no writes.
pnpm migrate:docs

# Apply after reviewing the report. --backup is mandatory and creates a
# timestamped docs_backup_* collection before changing any documents.
pnpm migrate:docs -- --apply --backup
```

Duplicate merges preserve the earliest added date, any read state, the most
recent known read date, and the best available title. Removed duplicate IDs are
recorded on the surviving document. Invalid legacy URLs are reported and left
unchanged.

Do not run apply mode until `MONGODB_URI` explicitly points to the intended
database and the dry-run report has been reviewed.

## Metadata processing

Saving a URL no longer waits for remote metadata. The API stores the item first,
returns success to the browser or extension, and schedules title enrichment with
Next.js `after()`. Failed enrichment never removes an existing title. Users can
retry extraction or enter a manual title, which subsequent refreshes preserve.

Remote fetches accept only HTTP(S), limit response size and redirects, and reject
localhost, private networks, link-local addresses, and other non-public IPs.

## Chrome extension compatibility

The extension remains in `chrome-extension` and does not need to change. It still
sends:

```http
POST /api/docs
Content-Type: application/json

{ "url": "https://example.com/article" }
```

New documents return `201`; existing documents return `200` with
`duplicate: true`. Both are successful responses for the current extension.

## API

- `GET /api/docs?status=unread|read|all&q=&cursor=` — paginated library.
- `POST /api/docs` — save or return an existing URL.
- `PATCH /api/docs` — update read state, edit a title, or restore an item.
- `DELETE /api/docs` — soft-delete an item.
- `PUT /api/docs` — retry one item or schedule a small missing-title backfill.

All endpoints require an authenticated Google session.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
