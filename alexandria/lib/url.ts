const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "mkt_tok",
  "oly_anon_id",
  "oly_enc_id",
  "vero_conv",
  "vero_id",
  "wickedid",
  "yclid",
  "_hsenc",
  "_hsmi",
]);

const TRACKING_PREFIXES = ["utm_", "pk_", "mtm_"];

export type NormalizedDocUrl = {
  url: string;
  dedupeKey: string;
  domain: string;
  provider: "arxiv" | "doi" | "web";
};

const isTrackingParameter = (name: string) => {
  const lowerName = name.toLowerCase();
  return (
    TRACKING_PARAMETERS.has(lowerName) ||
    TRACKING_PREFIXES.some((prefix) => lowerName.startsWith(prefix))
  );
};

const normalizePathname = (pathname: string) => {
  const normalized = pathname.replace(/\/{2,}/g, "/");
  if (normalized.length > 1 && normalized.endsWith("/")) {
    return normalized.slice(0, -1);
  }
  return normalized || "/";
};

const getArxivId = (url: URL) => {
  if (url.hostname !== "arxiv.org" && url.hostname !== "www.arxiv.org") {
    return null;
  }
  const match = url.pathname.match(/^\/(?:abs|pdf)\/(.+?)(?:\.pdf)?\/?$/i);
  const identifier = match?.[1]?.replace(/^\/+|\/+$/g, "");
  if (!identifier) {
    return null;
  }
  return identifier.replace(/v\d+$/i, "").toLowerCase();
};

const getDoi = (url: URL) => {
  if (url.hostname !== "doi.org" && url.hostname !== "dx.doi.org") {
    return null;
  }
  const doi = decodeURIComponent(url.pathname).replace(/^\/+/, "").trim();
  return doi.toLowerCase().startsWith("10.") ? doi.toLowerCase() : null;
};

export const normalizeDocUrl = (value: string): NormalizedDocUrl => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("URL is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs can be saved.");
  }

  parsed.hash = "";
  parsed.username = "";
  parsed.password = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.pathname = normalizePathname(parsed.pathname);

  for (const key of Array.from(parsed.searchParams.keys())) {
    if (isTrackingParameter(key)) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.searchParams.sort();

  const arxivId = getArxivId(parsed);
  const doi = getDoi(parsed);
  const url = parsed.toString();

  if (arxivId) {
    return {
      url,
      dedupeKey: `arxiv:${arxivId}`,
      domain: "arxiv.org",
      provider: "arxiv",
    };
  }

  if (doi) {
    return {
      url,
      dedupeKey: `doi:${doi}`,
      domain: "doi.org",
      provider: "doi",
    };
  }

  return {
    url,
    dedupeKey: `url:${url}`,
    domain: parsed.hostname.replace(/^www\./, ""),
    provider: "web",
  };
};

// Retained for compatibility with earlier callers. Cleanup is now selective,
// so meaningful query parameters are not discarded.
export const stripUrlArguments = (value: string) => {
  try {
    return normalizeDocUrl(value).url;
  } catch {
    return "";
  }
};
