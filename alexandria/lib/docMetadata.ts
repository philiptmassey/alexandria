import { XMLParser } from "fast-xml-parser";
import { fetchSafeSnippet } from "@/lib/safeFetch";
import { normalizeDocUrl } from "@/lib/url";

export type DocMetadata = {
  title?: string;
};

const MAX_SNIFF_BYTES = 768 * 1024;
const FETCH_TIMEOUT_MS = 8000;
const DEFAULT_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/pdf,application/json;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (compatible; Alexandria/1.0; +https://alexandria-psi.vercel.app)",
};

const normalizeTitle = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const title = decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
  return title.length > 0 ? title : undefined;
};

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/gi, (_, number) =>
      String.fromCodePoint(Number.parseInt(number, 10)),
    );

const stripTags = (value: string) => value.replace(/<[^>]+>/g, " ");

const parseMetaAttributes = (raw: string) => {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw)) !== null) {
    attributes[match[1].toLowerCase()] = match[3] ?? match[4] ?? match[5] ?? "";
  }
  return attributes;
};

const extractMetaTitles = (html: string) => {
  const titles = new Map<string, string>();
  const pattern = /<meta\b([^>]*?)>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const attributes = parseMetaAttributes(match[1]);
    const key = (attributes.property ?? attributes.name ?? "").toLowerCase();
    const value = normalizeTitle(attributes.content);
    if (value && !titles.has(key)) titles.set(key, value);
  }
  return titles;
};

const findJsonLdTitle = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const title = findJsonLdTitle(item);
      if (title) return title;
    }
    return undefined;
  }
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const type = Array.isArray(record["@type"])
    ? record["@type"].join(" ")
    : String(record["@type"] ?? "");
  if (/article|posting|scholarly|creativework/i.test(type)) {
    const title = normalizeTitle(record.headline) ?? normalizeTitle(record.name);
    if (title) return title;
  }

  for (const child of Object.values(record)) {
    const title = findJsonLdTitle(child);
    if (title) return title;
  }
  return undefined;
};

const extractJsonLdTitle = (html: string) => {
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const title = findJsonLdTitle(JSON.parse(match[1]));
      if (title) return title;
    } catch {
      // Ignore malformed JSON-LD and continue through the remaining signals.
    }
  }
  return undefined;
};

const getFirstTagText = (html: string, tag: "title" | "h1") => {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return normalizeTitle(match?.[1] ? stripTags(match[1]) : undefined);
};

export const extractTitleFromHtml = (html: string) => {
  const meta = extractMetaTitles(html);
  return (
    meta.get("og:title") ??
    meta.get("twitter:title") ??
    extractJsonLdTitle(html) ??
    getFirstTagText(html, "title") ??
    getFirstTagText(html, "h1")
  );
};

const extractPdfLiteral = (text: string, startIndex: number) => {
  const openIndex = text.indexOf("(", startIndex);
  if (openIndex === -1) return null;
  let depth = 1;
  let result = "";
  for (let index = openIndex + 1; index < text.length; index += 1) {
    const character = text[index];
    if (character === "\\" && index + 1 < text.length) {
      result += text[index + 1];
      index += 1;
    } else if (character === "(") {
      depth += 1;
      result += character;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) return result;
      result += character;
    } else {
      result += character;
    }
  }
  return null;
};

const decodePdfHex = (hex: string) => {
  const bytes = Buffer.from(hex, "hex");
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let result = "";
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      result += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
    }
    return result;
  }
  return bytes.toString("latin1");
};

export const extractTitleFromPdf = (bytes: Uint8Array) => {
  const text = Buffer.from(bytes).toString("latin1");
  const titleIndex = text.indexOf("/Title");
  if (titleIndex === -1) return undefined;

  const literal = extractPdfLiteral(text, titleIndex);
  if (literal) return normalizeTitle(literal);

  const hex = text.slice(titleIndex, titleIndex + 512).match(/\/Title\s*<([0-9a-fA-F]+)>/)?.[1];
  return hex ? normalizeTitle(decodePdfHex(hex)) : undefined;
};

const isPdf = (bytes: Uint8Array, contentType: string | null) =>
  Boolean(contentType?.toLowerCase().includes("pdf")) ||
  Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-";

const decodeText = (bytes: Uint8Array, contentType: string | null) => {
  const charset = contentType?.match(/charset=([^;\s]+)/i)?.[1]?.replace(/["']/g, "");
  try {
    return new TextDecoder(charset || "utf-8", { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
};

const fetchSnippet = (url: string) =>
  fetchSafeSnippet(url, {
    maxBytes: MAX_SNIFF_BYTES,
    timeoutMs: FETCH_TIMEOUT_MS,
    headers: DEFAULT_HEADERS,
  });

const getArxivTitle = async (identifier: string) => {
  const response = await fetchSnippet(
    `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(identifier)}`,
  );
  if (!response) return undefined;
  const xml = decodeText(response.bytes, response.contentType);
  const parsed = new XMLParser({ ignoreAttributes: false, trimValues: true }).parse(xml);
  const entry = parsed?.feed?.entry;
  const firstEntry = Array.isArray(entry) ? entry[0] : entry;
  return normalizeTitle(firstEntry?.title);
};

const getCrossrefTitle = async (doi: string) => {
  const response = await fetchSnippet(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
  );
  if (!response) return undefined;
  try {
    const payload = JSON.parse(decodeText(response.bytes, response.contentType));
    const title = payload?.message?.title;
    return normalizeTitle(Array.isArray(title) ? title[0] : title);
  } catch {
    return undefined;
  }
};

export const gatherDocMetadata = async (url: string): Promise<DocMetadata> => {
  const normalized = normalizeDocUrl(url);
  if (normalized.provider === "arxiv") {
    const title = await getArxivTitle(normalized.dedupeKey.slice("arxiv:".length));
    if (title) return { title };
  }
  if (normalized.provider === "doi") {
    const title = await getCrossrefTitle(normalized.dedupeKey.slice("doi:".length));
    if (title) return { title };
  }

  const response = await fetchSnippet(normalized.url);
  if (!response) return {};
  if (isPdf(response.bytes, response.contentType)) {
    return { title: extractTitleFromPdf(response.bytes) };
  }
  return {
    title: extractTitleFromHtml(decodeText(response.bytes, response.contentType)),
  };
};
