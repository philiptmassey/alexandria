export type DocMetadata = {
  title?: string;
};

const MAX_SNIFF_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 8000;
const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DEFAULT_ACCEPT_LANGUAGE = "en-US,en;q=0.9";

const normalizeTitle = (value: string | null | undefined) => {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/gi, (_, num) =>
      String.fromCharCode(Number.parseInt(num, 10)),
    );

const parseMetaAttributes = (raw: string) => {
  const attrs: Record<string, string> = {};
  const attrRegex = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null = null;
  while ((match = attrRegex.exec(raw)) !== null) {
    const key = match[1]?.toLowerCase();
    if (!key) {
      continue;
    }
    const value = match[3] ?? match[4] ?? match[5] ?? "";
    attrs[key] = value;
  }
  return attrs;
};

const extractHeadingTitles = (html: string) => {
  const matches = html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi);
  const titles: string[] = [];
  for (const match of matches) {
    const cleaned = match[1]?.replace(/<[^>]+>/g, " ");
    const normalized = normalizeTitle(
      cleaned ? decodeHtmlEntities(cleaned) : "",
    );
    if (normalized) {
      titles.push(normalized);
    }
  }
  return titles;
};

const pickBestHeadingTitle = (titles: string[]) => {
  if (titles.length === 0) {
    return undefined;
  }
  const counts = new Map<string, { count: number; index: number }>();
  titles.forEach((title, index) => {
    const entry = counts.get(title);
    if (entry) {
      entry.count += 1;
      return;
    }
    counts.set(title, { count: 1, index });
  });

  let bestTitle = titles[0];
  let bestCount = 0;
  let bestLength = 0;
  let bestIndex = Number.POSITIVE_INFINITY;
  for (const [title, { count, index }] of counts.entries()) {
    const length = title.length;
    if (
      count > bestCount ||
      (count === bestCount && length > bestLength) ||
      (count === bestCount && length === bestLength && index < bestIndex)
    ) {
      bestTitle = title;
      bestCount = count;
      bestLength = length;
      bestIndex = index;
    }
  }

  return bestTitle;
};

const buildHeadingCounts = (titles: string[]) => {
  const counts = new Map<string, number>();
  for (const title of titles) {
    const key = title.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

const splitTitleSegments = (title: string) => {
  const normalized = title.replace(/\s+/g, " ").trim();
  const segments = normalized
    .split(/\s+(?:\|+|—|–|-|:|·|•|::)\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return segments.length > 0 ? segments : [normalized];
};

const STOP_SLUG_TOKENS = new Set([
  "the",
  "and",
  "or",
  "of",
  "a",
  "an",
  "to",
  "in",
  "on",
  "for",
  "with",
  "by",
  "from",
  "at",
  "as",
  "is",
  "are",
  "be",
]);

const extractUrlSlugTokens = (url: string | undefined) => {
  if (!url) {
    return [];
  }
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length === 0) {
      return [];
    }
    let slug = "";
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const candidate = parts[i].toLowerCase();
      if (candidate && candidate !== "index" && candidate !== "home") {
        slug = candidate;
        break;
      }
    }
    if (!slug) {
      return [];
    }
    slug = slug.replace(/\.(html?|php|aspx?)$/i, "");
    const tokens = slug
      .replace(/[_-]+/g, " ")
      .replace(/[^a-z0-9 ]+/gi, " ")
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length >= 2 && !/^\d+$/.test(token))
      .filter((token) => !STOP_SLUG_TOKENS.has(token));
    return Array.from(new Set(tokens));
  } catch {
    return [];
  }
};

const pickBestTitleSegment = (
  segments: string[],
  headingCounts: Map<string, number>,
  url?: string,
) => {
  if (segments.length <= 1) {
    return undefined;
  }
  const slugTokens = extractUrlSlugTokens(url);
  let bestSegment: string | undefined;
  let bestSlugMatches = 0;
  let bestHeadingCount = 0;
  let bestLength = 0;

  for (const segment of segments) {
    const lower = segment.toLowerCase();
    let slugMatches = 0;
    for (const token of slugTokens) {
      if (lower.includes(token)) {
        slugMatches += 1;
      }
    }
    const headingCount = headingCounts.get(lower) ?? 0;
    const length = segment.length;
    if (
      slugMatches > bestSlugMatches ||
      (slugMatches === bestSlugMatches && headingCount > bestHeadingCount) ||
      (slugMatches === bestSlugMatches &&
        headingCount === bestHeadingCount &&
        length > bestLength)
    ) {
      bestSegment = segment;
      bestSlugMatches = slugMatches;
      bestHeadingCount = headingCount;
      bestLength = length;
    }
  }

  if (
    (bestSlugMatches >= 2 || (bestSlugMatches >= 1 && bestLength >= 12)) ||
    bestHeadingCount >= 2
  ) {
    return bestSegment;
  }

  return undefined;
};

const readResponseBytes = async (response: Response, maxBytes: number) => {
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.subarray(0, maxBytes);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    if (total + value.length >= maxBytes) {
      chunks.push(value.subarray(0, maxBytes - total));
      total = maxBytes;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    total += value.length;
  }

  if (chunks.length === 0) {
    return new Uint8Array();
  }

  const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return buffer.subarray(0, maxBytes);
};

const fetchUrlSnippet = async (url: string) => {
  const baseHeaders = {
    Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
    "Accept-Language": DEFAULT_ACCEPT_LANGUAGE,
    "User-Agent": DEFAULT_UA,
  };

  const response = await fetch(url, {
    headers: { ...baseHeaders, Range: `bytes=0-${MAX_SNIFF_BYTES - 1}` },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    if (response.status !== 416) {
      return null;
    }
    const fallback = await fetch(url, {
      headers: baseHeaders,
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!fallback.ok) {
      return null;
    }
    const fallbackBytes = await readResponseBytes(fallback, MAX_SNIFF_BYTES);
    return {
      bytes: fallbackBytes,
      contentType: fallback.headers.get("content-type"),
    };
  }

  const bytes = await readResponseBytes(response, MAX_SNIFF_BYTES);
  return {
    bytes,
    contentType: response.headers.get("content-type"),
  };
};

const isPdfSnippet = (bytes: Uint8Array, contentType: string | null) => {
  if (contentType?.toLowerCase().includes("pdf")) {
    return true;
  }
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
};

const extractNextDataTitle = (html: string) => {
  const match = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match?.[1]) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(match[1]);
    const pathCandidates: Array<Array<string>> = [
      ["props", "pageProps", "title"],
      ["props", "pageProps", "seo", "title"],
      ["pageProps", "title"],
    ];
    for (const path of pathCandidates) {
      let cursor: unknown = parsed;
      for (const key of path) {
        if (!cursor || typeof cursor !== "object") {
          cursor = undefined;
          break;
        }
        cursor = (cursor as Record<string, unknown>)[key];
      }
      if (typeof cursor === "string") {
        const normalized = normalizeTitle(decodeHtmlEntities(cursor));
        if (normalized) {
          return normalized;
        }
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
};

const extractMetaTitle = (html: string) => {
  const metaRegex = /<meta\b([^>]*?)>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = metaRegex.exec(html)) !== null) {
    const attrs = parseMetaAttributes(match[1]);
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (key === "og:title" || key === "twitter:title" || key === "title") {
      const normalized = normalizeTitle(
        decodeHtmlEntities(attrs.content ?? ""),
      );
      if (normalized) {
        return normalized;
      }
    }
  }
  return undefined;
};

const extractTitleFromHtml = (html: string, url?: string) => {
  const headings = extractHeadingTitles(html);
  const headingCounts = buildHeadingCounts(headings);

  const nextTitle = extractNextDataTitle(html);
  if (nextTitle) {
    return nextTitle;
  }

  const metaTitle = extractMetaTitle(html);
  if (metaTitle) {
    const segments = splitTitleSegments(metaTitle);
    const refined = pickBestTitleSegment(segments, headingCounts, url);
    return refined ?? metaTitle;
  }

  const headingTitle = pickBestHeadingTitle(headings);
  if (headingTitle) {
    return headingTitle;
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch?.[1]) {
    return undefined;
  }
  const cleaned = titleMatch[1].replace(/<[^>]+>/g, " ");
  const normalized = normalizeTitle(decodeHtmlEntities(cleaned));
  if (!normalized) {
    return undefined;
  }
  const segments = splitTitleSegments(normalized);
  const refined = pickBestTitleSegment(segments, headingCounts, url);
  return refined ?? normalized;
};

const extractPdfLiteral = (text: string, startIndex: number) => {
  const openIndex = text.indexOf("(", startIndex);
  if (openIndex === -1) {
    return null;
  }
  let depth = 1;
  let result = "";
  for (let i = openIndex + 1; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\\") {
      if (i + 1 < text.length) {
        result += text[i + 1];
        i += 1;
      }
      continue;
    }
    if (char === "(") {
      depth += 1;
      result += char;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return result;
      }
      result += char;
      continue;
    }
    result += char;
  }
  return null;
};

const decodePdfHex = (hex: string) => {
  const bytes = Buffer.from(hex, "hex");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let result = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      result += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return result;
  }
  return bytes.toString("latin1");
};

const extractTitleFromPdf = (bytes: Uint8Array) => {
  const text = Buffer.from(bytes).toString("latin1");

  const titleIndex = text.indexOf("/Title");
  if (titleIndex !== -1) {
    const literalTitle = extractPdfLiteral(text, titleIndex);
    if (literalTitle) {
      const title = normalizeTitle(literalTitle);
      if (title) {
        return title;
      }
    }
    const hexMatch = text
      .slice(titleIndex, titleIndex + 200)
      .match(/\/Title\s*<([0-9a-fA-F]+)>/);
    if (hexMatch?.[1]) {
      const title = normalizeTitle(decodePdfHex(hexMatch[1]));
      if (title) {
        return title;
      }
    }
  }

  return undefined;
};

export const gatherDocMetadata = async (url: string): Promise<DocMetadata> => {
  const snippet = await fetchUrlSnippet(url);
  if (!snippet) {
    return {};
  }

  if (isPdfSnippet(snippet.bytes, snippet.contentType)) {
    const title = extractTitleFromPdf(snippet.bytes);
    return title ? { title } : {};
  }

  const html = new TextDecoder("utf-8", { fatal: false }).decode(
    snippet.bytes,
  );
  const title = extractTitleFromHtml(html, url);
  return title ? { title } : {};
};
