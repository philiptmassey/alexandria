import { describe, expect, it } from "vitest";
import { extractTitleFromHtml, extractTitleFromPdf } from "./docMetadata";

describe("extractTitleFromHtml", () => {
  it("prefers Open Graph metadata and decodes entities", () => {
    const html = `
      <html><head>
        <title>Site title</title>
        <meta property="og:title" content="Research &amp; Practice" />
      </head><body><h1>Heading title</h1></body></html>
    `;
    expect(extractTitleFromHtml(html)).toBe("Research & Practice");
  });

  it("uses article JSON-LD when social metadata is absent", () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"ScholarlyArticle","headline":"Recursive Language Models"}
      </script>
    `;
    expect(extractTitleFromHtml(html)).toBe("Recursive Language Models");
  });

  it("falls back to the document title before the first heading", () => {
    expect(
      extractTitleFromHtml("<title>  A useful essay  </title><h1>Navigation</h1>"),
    ).toBe("A useful essay");
  });
});

describe("extractTitleFromPdf", () => {
  it("extracts literal PDF metadata", () => {
    const bytes = Buffer.from("%PDF-1.7\n<< /Title (A Paper With \\(Context\\)) >>");
    expect(extractTitleFromPdf(bytes)).toBe("A Paper With (Context)");
  });

  it("extracts UTF-16BE hexadecimal metadata", () => {
    const value = Buffer.from([0xfe, 0xff, 0x00, 0x41, 0x00, 0x49]).toString("hex");
    const bytes = Buffer.from(`%PDF-1.7\n<< /Title <${value}> >>`);
    expect(extractTitleFromPdf(bytes)).toBe("AI");
  });
});
