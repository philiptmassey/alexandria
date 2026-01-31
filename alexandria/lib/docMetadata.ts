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

const extractHeadingTitle = (html: string) => {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!h1Match?.[1]) {
    return undefined;
  }
  const cleaned = h1Match[1].replace(/<[^>]+>/g, " ");
  return normalizeTitle(decodeHtmlEntities(cleaned));
};

const extractTitleFromHtml = (html: string) => {
  const nextTitle = extractNextDataTitle(html);
  if (nextTitle) {
    return nextTitle;
  }

  const headingTitle = extractHeadingTitle(html);
  if (headingTitle) {
    return headingTitle;
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch?.[1]) {
    return undefined;
  }
  const cleaned = titleMatch[1].replace(/<[^>]+>/g, " ");
  const normalized = normalizeTitle(decodeHtmlEntities(cleaned));
  if (normalized) {
    return normalized;
  }
  return undefined;
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
  const title = extractTitleFromHtml(html);
  return title ? { title } : {};
};
