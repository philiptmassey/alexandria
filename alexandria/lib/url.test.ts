import { describe, expect, it } from "vitest";
import { normalizeDocUrl } from "./url";

describe("normalizeDocUrl", () => {
  it("removes tracking parameters while preserving content parameters", () => {
    expect(
      normalizeDocUrl(
        "https://Example.com/article/?utm_source=newsletter&id=42&fbclid=abc#section",
      ),
    ).toEqual({
      url: "https://example.com/article?id=42",
      dedupeKey: "url:https://example.com/article?id=42",
      domain: "example.com",
      provider: "web",
    });
  });

  it("sorts parameters to produce a stable key", () => {
    const first = normalizeDocUrl("https://example.com/read?b=2&a=1");
    const second = normalizeDocUrl("https://example.com/read?a=1&b=2");
    expect(first.dedupeKey).toBe(second.dedupeKey);
  });

  it("treats arXiv abstract and PDF URLs as the same paper", () => {
    const abstract = normalizeDocUrl("https://arxiv.org/abs/2512.24601v2");
    const pdf = normalizeDocUrl("https://www.arxiv.org/pdf/2512.24601.pdf");
    expect(abstract.dedupeKey).toBe("arxiv:2512.24601");
    expect(pdf.dedupeKey).toBe(abstract.dedupeKey);
  });

  it("normalizes DOI links", () => {
    expect(normalizeDocUrl("https://doi.org/10.1000/ABC.Def").dedupeKey).toBe(
      "doi:10.1000/abc.def",
    );
  });

  it("rejects non-web protocols", () => {
    expect(() => normalizeDocUrl("file:///etc/passwd")).toThrow(
      "Only HTTP and HTTPS URLs",
    );
  });
});
