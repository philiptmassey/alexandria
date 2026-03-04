# Alexandria

Personal reading queue for saving and managing articles with Google sign-in.

## What It Does
- Save URLs and auto-extract titles from HTML or PDF.
- Keep unread and read lists with timestamps.
- Mark read/unread, delete entries, and open links.
- Save the current tab with the Chrome extension.

## Tech Stack
- Next.js (App Router)
- NextAuth (Google)
- MongoDB

## Local Setup
1. Start MongoDB locally or use MongoDB Atlas.

Local MongoDB default:

```bash
mongod --dbpath ./data/mongo
```

2. Install dependencies and run the dev server.

```bash
pnpm install
pnpm dev
# or
npm run dev
# or
yarn dev
# or
bun dev
```

3. Open http://localhost:3000.

## Environment Variables
- MONGODB_URI
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- NEXTAUTH_SECRET
- NEXTAUTH_URL (optional, recommended in production)

Do not commit actual values.

## Chrome Extension
The extension lives in `chrome-extension`.

Unpacked install steps:
1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click "Load unpacked" and select the `chrome-extension` folder.
4. Open the extension options and set your app base URL.

For more details, see `chrome-extension/README.md`.

## API Overview
All endpoints require Google sign-in.

- `GET /api/docs` lists saved documents.
- `POST /api/docs` adds a URL.
- `PATCH /api/docs` toggles read state.
- `DELETE /api/docs` removes a URL.

## Future Plans
- Search + filters (title/url/domain, read/unread, date ranges, optional sorting).
- Tags and labels.
- Bulk actions (mark read/unread, delete, tag).
- Duplicate detection on save.
- Metadata enrichment (domain, favicon, reading time).
- Notes and highlights.
- Import and export (CSV/JSON/bookmarks).
- Reminders or digest.
- Saved views.
