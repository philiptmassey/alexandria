import { describe, expect, it } from "vitest";
import { gatherDocMetadata } from "./docMetadata";

const openAiUrl =
  "https://openai.com/index/unrolling-the-codex-agent-loop/";
const arxivPdfUrl = "https://arxiv.org/pdf/2512.24601";

describe("gatherDocMetadata (live)", () => {
  it(
    "extracts title from OpenAI article",
    async () => {
      const metadata = await gatherDocMetadata(openAiUrl);
      expect(metadata.title).toBe("Unrolling the Codex agent loop");
    },
    { timeout: 20000 },
  );

  it(
    "extracts title from arXiv PDF metadata",
    async () => {
      const metadata = await gatherDocMetadata(arxivPdfUrl);
      expect(metadata.title).toBe("Recursive Language Models");
    },
    { timeout: 20000 },
  );
});
