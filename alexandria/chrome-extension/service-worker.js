const DEFAULT_API_BASE_URL = "https://alexandria-psi.vercel.app";
const STATUS_TIMEOUT_MS = 4000;
const BASE_ICON_PATHS = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
};
const STATUS_COLORS = {
  success: "#2e7d32",
  error: "#c62828",
};

let baseIconPromise;
let statusTimer;

const normalizeBaseUrl = (value) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch {
    return "";
  }
};

const isHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const getApiBaseUrl = async () => {
  const { apiBaseUrl } = await chrome.storage.sync.get("apiBaseUrl");
  const normalized = normalizeBaseUrl(apiBaseUrl);
  return normalized || DEFAULT_API_BASE_URL;
};

const loadBaseIcon = async () => {
  if (!baseIconPromise) {
    baseIconPromise = (async () => {
      const response = await fetch(chrome.runtime.getURL("icons/icon-128.png"));
      const blob = await response.blob();
      return createImageBitmap(blob);
    })();
  }
  return baseIconPromise;
};

const buildStatusIcon = async (status) => {
  const baseIcon = await loadBaseIcon();
  const color = STATUS_COLORS[status];
  const sizes = [16, 32, 48];
  const imageDataBySize = {};

  for (const size of sizes) {
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext("2d");
    if (!context) {
      continue;
    }
    context.clearRect(0, 0, size, size);
    context.drawImage(baseIcon, 0, 0, size, size);

    const radius = Math.max(2, Math.round(size * 0.18));
    const centerX = size - radius - 1;
    const centerY = radius + 1;

    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    context.lineWidth = Math.max(1, Math.round(size * 0.08));
    context.strokeStyle = "#ffffff";
    context.stroke();

    imageDataBySize[size] = context.getImageData(0, 0, size, size);
  }

  if (Object.keys(imageDataBySize).length === 0) {
    return null;
  }

  return imageDataBySize;
};

const setStatusIndicator = async ({ status, message }) => {
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = undefined;
  }

  if (status) {
    const imageData = await buildStatusIcon(status);
    if (imageData) {
      await chrome.action.setIcon({ imageData });
    } else {
      await chrome.action.setIcon({ path: BASE_ICON_PATHS });
    }
    if (message) {
      await chrome.action.setTitle({ title: message });
    }
    statusTimer = setTimeout(() => {
      chrome.action.setIcon({ path: BASE_ICON_PATHS });
      chrome.action.setTitle({ title: "Save to unread queue" });
    }, STATUS_TIMEOUT_MS);
    return;
  }

  await chrome.action.setIcon({ path: BASE_ICON_PATHS });
  await chrome.action.setTitle({ title: "Save to unread queue" });
};

const saveUrl = async (url) => {
  const baseUrl = await getApiBaseUrl();
  const endpoint = `${baseUrl}/api/docs`;

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ url }),
    });
  } catch {
    await setStatusIndicator({
      status: "error",
      message: `Could not reach ${baseUrl}. Check your app URL in settings.`,
    });
    return;
  }

  const payload = await response.json().catch(() => null);
  const apiError =
    payload && typeof payload.error === "string" ? payload.error : "";

  if (response.ok) {
    await setStatusIndicator({
      status: "success",
      message: "Added to your unread queue.",
    });
    return;
  }

  if (response.status === 401) {
    await setStatusIndicator({
      status: "error",
      message: "Sign in to Alexandria in this browser, then try again.",
    });
    return;
  }

  await setStatusIndicator({
    status: "error",
    message: apiError || `Request failed (${response.status}).`,
  });
};

chrome.runtime.onInstalled.addListener(async () => {
  const { apiBaseUrl } = await chrome.storage.sync.get("apiBaseUrl");
  if (!apiBaseUrl) {
    await chrome.storage.sync.set({ apiBaseUrl: DEFAULT_API_BASE_URL });
  }
});

chrome.action.onClicked.addListener((tab) => {
  const url = tab && typeof tab.url === "string" ? tab.url : "";
  if (!url || !isHttpUrl(url)) {
    void setStatusIndicator({
      status: "error",
      message: "This page does not have a saveable URL.",
    });
    return;
  }
  void saveUrl(url);
});
