import { describe, expect, it } from "vitest";
import { CTF_DETECTORS } from "../src/features/ctf/detectors";
import { DEFAULT_FLAG_PATTERNS } from "../src/features/ctf/flagPatterns";
import { CTF_HINT_SECTIONS } from "../src/features/ctf/hints";
import { CTF_TRANSFORMS } from "../src/features/ctf/transforms";

const getTransform = (id: string) => {
  const transform = CTF_TRANSFORMS.find((candidate) => candidate.id === id);
  expect(transform).toBeDefined();
  return transform;
};

const getDetector = (id: string) => {
  const detector = CTF_DETECTORS.find((candidate) => candidate.id === id);
  expect(detector).toBeDefined();
  return detector;
};

describe("CTF feature modules", () => {
  it("ヒント定義をページ外のモジュールから参照できること", () => {
    expect(CTF_HINT_SECTIONS.length).toBeGreaterThan(0);
    expect(CTF_HINT_SECTIONS.map((section) => section.title)).toContain("Forensics");
  });

  it("各 transform が必要なメタデータと run を持つこと", () => {
    expect(CTF_TRANSFORMS.length).toBeGreaterThan(0);
    for (const transform of CTF_TRANSFORMS) {
      expect(transform.id).not.toHaveLength(0);
      expect(transform.label).not.toHaveLength(0);
      expect(transform.category).not.toHaveLength(0);
      expect(transform.description).not.toHaveLength(0);
      expect(transform.run).toBeInstanceOf(Function);
    }
  });

  it("Base64 transform が UTF-8 文字列を往復変換できること", () => {
    const encoder = getTransform("base64-encode");
    const decoder = getTransform("base64-decode");
    const encoded = encoder?.run("CTF テスト").output;

    expect(encoded).toBe("Q1RGIOODhuOCueODiA==");
    expect(decoder?.run(encoded ?? "").output).toBe("CTF テスト");
  });

  it("flag pattern が固定値ではなく初期設定リストとして管理されること", () => {
    expect(DEFAULT_FLAG_PATTERNS.map((pattern) => pattern.label)).toEqual([
      "flag{...}",
      "ctf{...}",
      "HTB{...}",
      "picoCTF{...}",
    ]);
  });

  it("flag detector が設定された正規表現から検出範囲と推奨アクションを返すこと", () => {
    const detector = getDetector("flag-pattern");
    const detections = detector?.detect("answer is picoCTF{sample_flag}") ?? [];

    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      type: "picoctf-braces",
      confidence: 0.95,
      range: { start: 10, end: 30 },
    });
    expect(detections[0]?.recommendedActions.length).toBeGreaterThan(0);
  });

  it("flag detector が UI 追加を想定したカスタムパターンを受け取れること", () => {
    const detector = getDetector("flag-pattern");
    const detections = detector?.detect("custom KEY-1234", {
      flagPatterns: [
        {
          id: "custom-key",
          label: "KEY-####",
          source: "KEY-\\d{4}",
          flags: "g",
          description: "テスト用の追加パターンです。",
        },
      ],
    }) ?? [];

    expect(detections).toHaveLength(1);
    expect(detections[0]?.type).toBe("custom-key");
  });
});
