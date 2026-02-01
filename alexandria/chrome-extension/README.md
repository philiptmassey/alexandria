# Alexandria Chrome Extension

One-click saver that posts the current tab URL to your Alexandria unread queue.

## Setup

1. Visit `chrome://extensions`.
2. Enable Developer Mode.
3. Click "Load unpacked" and select the `chrome-extension` folder.
4. Open the extension options and set your app URL (default is `https://alexandria-psi.vercel.app`).
5. Make sure you are signed in to Alexandria in the same browser.

## Usage

- Click the extension icon to save the current tab.
- A green or red status dot appears on the icon for a few seconds.

## Notes

- The extension calls `POST /api/docs` using your existing web session cookie.
- If the status dot is red, hover the icon to see the error message.
- The manifest only allows the production app URL (and localhost for dev).
  Tighten or expand `host_permissions` if you need another domain.
