import { describe, expect, it } from "vitest";
import { detectCtfArtifacts } from "../src/features/ctf/detectors";
import { collectFlagCandidates } from "../src/features/ctf/flagPatterns";
import { CTF_TRANSFORMS } from "../src/features/ctf/transforms";
import { generateWriteupMarkdown } from "../src/features/ctf/writeup";

describe("CTF workbench utilities", () => {
  it("flag候補とBase64らしい文字列を検出できること", () => {
    const detections = detectCtfArtifacts("note flag{sample_flag} ZmxhZ3t0ZXN0fQ==");

    expect(detections.some((detection) => detection.label.includes("flag候補"))).toBe(true);
    expect(detections.some((detection) => detection.label.includes("Base64"))).toBe(true);
  });

  it("設定済みflag形式から候補を収集できること", () => {
    const candidates = collectFlagCandidates("picoCTF{abc_123} HTB{box}");

    expect(candidates.map((candidate) => candidate.value)).toContain("picoCTF{abc_123}");
    expect(candidates.map((candidate) => candidate.value)).toContain("HTB{box}");
  });

  it("Base64 decode変換を実行できること", () => {
    const transform = CTF_TRANSFORMS.find((item) => item.id === "base64-decode");
    const result = transform?.run("ZmxhZ3t0ZXN0fQ==")[0];

    expect(result?.success).toBe(true);
    expect(result?.output).toBe("flag{test}");
  });

  it("writeup Markdownを生成できること", () => {
    const markdown = generateWriteupMarkdown({
      challengeName: "sample",
      sourceText: "flag{sample}",
      notes: "Base64を確認",
      operations: [],
      flagCandidates: [{ patternId: "generic-flag", patternLabel: "flag{...}", value: "flag{sample}" }],
    });

    expect(markdown).toContain("# Challenge: sample");
    expect(markdown).toContain("flag{sample}");
    expect(markdown).toContain("Base64を確認");
  });
});
