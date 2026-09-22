import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 5;

const isPublicIpv4 = (address: string) => {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return false;
  }
  const [a, b, c] = octets;
  if (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  ) {
    return false;
  }
  return true;
};

const isPublicIpv6 = (address: string) => {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("ff") ||
    /^fe[89ab]/.test(normalized) ||
    normalized === "2001:db8::" ||
    normalized.startsWith("2001:db8:")
  ) {
    return false;
  }

  const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) return isPublicIpv4(mappedIpv4);

  const mappedHex = normalized.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const high = Number.parseInt(mappedHex[1], 16);
    const low = Number.parseInt(mappedHex[2], 16);
    return isPublicIpv4(
      `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`,
    );
  }
  return true;
};

export const isPublicIpAddress = (address: string) => {
  const version = isIP(address.replace(/^\[|\]$/g, ""));
  if (version === 4) {
    return isPublicIpv4(address);
  }
  if (version === 6) {
    return isPublicIpv6(address);
  }
  return false;
};

export const assertSafeRemoteUrl = async (value: string) => {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs can be fetched.");
  }
  if (url.username || url.password) {
    throw new Error("URLs containing credentials cannot be fetched.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Local network URLs cannot be fetched.");
  }

  if (isIP(hostname)) {
    if (!isPublicIpAddress(hostname)) {
      throw new Error("Private network URLs cannot be fetched.");
    }
    return url;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicIpAddress(address))
  ) {
    throw new Error("The URL resolves to a private network address.");
  }
  return url;
};

const readResponseBytes = async (response: Response, maxBytes: number) => {
  if (!response.body) {
    return new Uint8Array((await response.arrayBuffer()).slice(0, maxBytes));
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    const remaining = maxBytes - total;
    chunks.push(value.subarray(0, remaining));
    total += Math.min(value.length, remaining);
  }
  if (total >= maxBytes) {
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
};

export type SafeFetchSnippet = {
  bytes: Uint8Array;
  contentType: string | null;
  finalUrl: string;
};

export const fetchSafeSnippet = async (
  value: string,
  options: {
    maxBytes: number;
    timeoutMs: number;
    headers?: Record<string, string>;
  },
): Promise<SafeFetchSnippet | null> => {
  let current = await assertSafeRemoteUrl(value);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(current, {
      headers: options.headers,
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      if (!location || redirectCount === MAX_REDIRECTS) {
        return null;
      }
      current = await assertSafeRemoteUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) {
      return null;
    }

    return {
      bytes: await readResponseBytes(response, options.maxBytes),
      contentType: response.headers.get("content-type"),
      finalUrl: current.toString(),
    };
  }

  return null;
};
