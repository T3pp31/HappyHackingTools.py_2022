import { describe, it, expect } from "vitest";
import { NPCAP_DOWNLOAD_URL } from "../src/config/defaults";

/**
 * テスト観点表（等価分割・境界値）
 *
 * | # | 観点               | 入力/条件                | 期待結果                              | 種別     |
 * |---|-------------------|------------------------|--------------------------------------|---------|
 * | 1 | 値が正しい           | NPCAP_DOWNLOAD_URL     | "https://npcap.com/#download"        | 正常系   |
 * | 2 | 型がstring           | typeof                 | "string"                             | 正常系   |
 * | 3 | 空文字でない          | length > 0             | true                                 | 境界値   |
 * | 4 | httpsスキーム        | startsWith("https://") | true                                 | 正常系   |
 * | 5 | URL形式             | URL constructor        | 例外を投げない                         | 正常系   |
 * | 6 | 不正なURL変更検知     | 既知のURL値と一致        | "https://npcap.com/#download"と一致   | 回帰テスト |
 */

describe("NPCAP_DOWNLOAD_URL", () => {
  // --- 正常系 ---

  it("正しいNpcapダウンロードURLが設定されていること", () => {
    // Given: NPCAP_DOWNLOAD_URLがdefaults.tsで定義されている
    // When: 値を確認する
    // Then: "https://npcap.com/#download"であること
    expect(NPCAP_DOWNLOAD_URL).toBe("https://npcap.com/#download");
  });

  it("string型であること", () => {
    // Given: NPCAP_DOWNLOAD_URLが定義されている
    // When: 型を確認する
    // Then: string型であること
    expect(typeof NPCAP_DOWNLOAD_URL).toBe("string");
  });

  it("httpsスキームで始まること", () => {
    // Given: NPCAP_DOWNLOAD_URLが定義されている
    // When: プレフィックスを確認する
    // Then: "https://"で始まること
    expect(NPCAP_DOWNLOAD_URL.startsWith("https://")).toBe(true);
  });

  it("有効なURL形式であること", () => {
    // Given: NPCAP_DOWNLOAD_URLが定義されている
    // When: URL constructorでパースする
    // Then: 例外が投げられないこと
    expect(() => new URL(NPCAP_DOWNLOAD_URL)).not.toThrow();
  });

  // --- 境界値 ---

  it("空文字でないこと", () => {
    // Given: NPCAP_DOWNLOAD_URLが定義されている
    // When: 長さを確認する
    // Then: 空文字でないこと
    expect(NPCAP_DOWNLOAD_URL.length).toBeGreaterThan(0);
  });

  // --- 回帰テスト ---

  it("URLが変更されていないこと（回帰テスト）", () => {
    // Given: 既知のURL値
    const expectedUrl = "https://npcap.com/#download";
    // When: 値を比較する
    // Then: 一致すること
    expect(NPCAP_DOWNLOAD_URL).toStrictEqual(expectedUrl);
  });
});
