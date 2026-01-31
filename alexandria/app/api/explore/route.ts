import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { XMLParser } from "fast-xml-parser";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const badRequest = (message: string) =>
  NextResponse.json({ error: message }, { status: 400 });

const unauthorized = (message = "Not authenticated.") =>
  NextResponse.json({ error: message }, { status: 401 });

const getUserId = (session: Session | null) => {
  const userId = (session?.user as { id?: string } | undefined)?.id;
  return userId && userId.trim().length > 0 ? userId : null;
};

const getUrlFromBody = (body: unknown) =>
  typeof (body as { url?: unknown })?.url === "string"
    ? (body as { url: string }).url.trim()
    : "";

const isValidUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

const normalizeText = (value: unknown) => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  return "";
};

const getAtomLink = (link: unknown) => {
  if (!link) {
    return "";
  }
  if (typeof link === "string") {
    return link.trim();
  }
  if (Array.isArray(link)) {
    const preferred =
      link.find((entry) => entry?.["@_rel"] === "alternate") ?? link[0];
    return normalizeText(preferred?.["@_href"] ?? preferred?.href ?? "");
  }
  return normalizeText((link as { "@_href"?: string })["@_href"]);
};

type NormalizedItem = {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
};

const normalizeItems = (feed: Record<string, unknown>): NormalizedItem[] => {
  const items: NormalizedItem[] = [];
  const rssItems =
    (feed?.rss as { channel?: { item?: unknown } } | undefined)?.channel?.item ??
    (feed?.channel as { item?: unknown } | undefined)?.item;

  const rssArray = Array.isArray(rssItems) ? rssItems : rssItems ? [rssItems] : [];

  for (const item of rssArray) {
    const raw = item as {
      title?: unknown;
      link?: unknown;
      guid?: unknown;
      pubDate?: unknown;
    };
    const title = normalizeText(raw.title) || normalizeText(raw.link) || "Untitled";
    const url = normalizeText(raw.link);
    const publishedAt = normalizeText(raw.pubDate);
    const id = normalizeText(raw.guid) || url || title;
    if (!url || !publishedAt) {
      continue;
    }
    items.push({ id, title, url, publishedAt });
  }

  const atomEntries =
    (feed?.feed as { entry?: unknown } | undefined)?.entry ??
    (feed?.atom as { entry?: unknown } | undefined)?.entry;
  const atomArray = Array.isArray(atomEntries)
    ? atomEntries
    : atomEntries
      ? [atomEntries]
      : [];

  for (const entry of atomArray) {
    const raw = entry as {
      title?: unknown;
      link?: unknown;
      id?: unknown;
      published?: unknown;
      updated?: unknown;
    };
    const title = normalizeText(raw.title) || "Untitled";
    const url = getAtomLink(raw.link);
    const publishedAt =
      normalizeText(raw.published) || normalizeText(raw.updated);
    const id = normalizeText(raw.id) || url || title;
    if (!url || !publishedAt) {
      continue;
    }
    items.push({ id, title, url, publishedAt });
  }

  return items;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = getUserId(session);
  if (!userId) {
    return unauthorized("User identity is missing.");
  }
  const body = await request.json().catch(() => null);
  const url = getUrlFromBody(body);

  if (!url) {
    return badRequest("RSS URL is required.");
  }

  if (!isValidUrl(url)) {
    return badRequest("Invalid URL.");
  }

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "Could not reach RSS feed." }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "Could not fetch RSS feed." },
      { status: 502 },
    );
  }

  const xml = await response.text();
  let feed: Record<string, unknown>;
  try {
    feed = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid RSS response." }, { status: 400 });
  }

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const items = normalizeItems(feed)
    .filter((item) => {
      const time = Date.parse(item.publishedAt);
      return Number.isFinite(time) && time >= cutoff;
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 40);

  return NextResponse.json({ items });
}
