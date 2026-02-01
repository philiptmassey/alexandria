# Alexandria Chrome Extension

One-click saver that posts the current tab URL to your Alexandria unread queue.

## Chrome Web Store

- Package the contents of `chrome-extension` as a zip for submission.
- This build targets `https://alexandria-psi.vercel.app` by default.
- Review the permissions and privacy policy below when filling out the listing.

## Local development (unpacked)

1. Visit `chrome://extensions`.
2. Enable Developer Mode.
3. Click "Load unpacked" and select the `chrome-extension` folder.
4. Open the extension options and set your app URL (default is `https://alexandria-psi.vercel.app`).
5. Make sure you are signed in to Alexandria in the same browser.

If you want to use a different domain locally, add it to `host_permissions`
in `manifest.json` and reload the extension.

## Usage

- Click the extension icon to save the current tab.
- A green or red status dot appears on the icon for a few seconds.
- Hover the icon to read any error message in the tooltip.

## Permissions rationale

- `activeTab`: read the current tab URL when you click the icon.
- `storage`: save the Alexandria app base URL in Chrome sync storage.
- `host_permissions`: allow requests to the Alexandria app domain.

## Privacy

See `PRIVACY_POLICY.md` for a store-ready privacy policy template.
