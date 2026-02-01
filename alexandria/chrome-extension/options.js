const DEFAULT_API_BASE_URL = "https://alexandria-psi.vercel.app";

const input = document.getElementById("apiBaseUrl");
const saveButton = document.getElementById("save");
const status = document.getElementById("status");

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

const setStatus = (message, state) => {
  status.textContent = message;
  status.dataset.state = state;
};

const load = async () => {
  const { apiBaseUrl } = await chrome.storage.sync.get("apiBaseUrl");
  const stored = typeof apiBaseUrl === "string" ? apiBaseUrl : "";
  input.value = stored || DEFAULT_API_BASE_URL;
};

const save = async () => {
  const normalized = normalizeBaseUrl(input.value);
  if (!normalized) {
    setStatus("Please enter a valid http/https URL.", "error");
    return;
  }
  await chrome.storage.sync.set({ apiBaseUrl: normalized });
  setStatus("Saved.", "success");
};

document.addEventListener("DOMContentLoaded", () => {
  void load();
});

saveButton.addEventListener("click", () => {
  void save();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void save();
  }
});
