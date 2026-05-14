import { describe, expect, it } from "vitest";
import { generateCtfWriteupMarkdown } from "../src/features/ctf/writeup";
import type { CtfWorkspace } from "../src/features/ctf/types";

const createWorkspace = (
  operations: CtfWorkspace["operations"],
): CtfWorkspace => ({
  id: "ctf-test",
  challengeName: "Chronology",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  notes: "",
  artifacts: [],
  observations: [],
  operations,
  flagCandidates: [],
});

describe("generateCtfWriteupMarkdown", () => {
  it("操作履歴を実行時刻の昇順で出力すること", () => {
    const markdown = generateCtfWriteupMarkdown(
      createWorkspace([
        {
          id: "op-2",
          name: "Exploit",
          inputSummary: "payload",
          outputSummary: "shell",
          executedAt: "2026-01-01T00:02:00.000Z",
          status: "success",
          notes: "",
        },
        {
          id: "op-1",
          name: "Recon",
          inputSummary: "file",
          outputSummary: "metadata",
          executedAt: "2026-01-01T00:01:00.000Z",
          status: "success",
          notes: "",
        },
      ]),
    );

    expect(markdown.indexOf("**Recon**")).toBeLessThan(
      markdown.indexOf("**Exploit**"),
    );
  });
});
