import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BUILD_RS_PATH = resolve(import.meta.dirname, "..", "src-tauri", "build.rs");
const buildRs = readFileSync(BUILD_RS_PATH, "utf-8");

describe("build.rs consistency", () => {
  it("main 関数が必要な初期化を呼んでいること", () => {
    assert.match(buildRs, /configure_npcap_link_search\(\);/);
    assert.match(buildRs, /configure_delay_load\(\);/);
    assert.match(buildRs, /tauri_build::build\(\);/);
  });

  it("Windows 用の Npcap SDK 探索定数が定義されていること", () => {
    assert.match(buildRs, /const NPCAP_SDK_ENV: &str = "NPCAP_SDK_DIR"/);
    assert.match(buildRs, /const NPCAP_DEFAULT_SEARCH_PATHS: &\[&str\] = &\[/);
    assert.match(buildRs, /C:\\npcap-sdk\\Lib\\x64/);
    assert.match(buildRs, /C:\\Program Files\\Npcap SDK\\Lib\\x64/);
    assert.match(buildRs, /USERPROFILE/);
    assert.match(buildRs, /\.npcap-sdk/);
  });

  it("ビルドスクリプトが rerun と link search を出力すること", () => {
    assert.match(buildRs, /cargo:rerun-if-env-changed=\{NPCAP_SDK_ENV\}/);
    assert.match(buildRs, /cargo:rustc-link-search=native=/);
  });

  it("Npcap SDK 未検出時のエラー文言が含まれていること", () => {
    assert.match(buildRs, /panic!/);
    assert.match(buildRs, /Npcap SDK/);
    assert.match(buildRs, /npcap\.com\/#download/);
  });

  it("非 Windows 向けの関数が空実装で定義されていること", () => {
    assert.match(
      buildRs,
      /#\[cfg\(not\(target_os = "windows"\)\)\]\s*fn configure_npcap_link_search\(\) \{\}/,
    );
    assert.match(
      buildRs,
      /#\[cfg\(not\(target_os = "windows"\)\)\]\s*fn configure_delay_load\(\) \{\}/,
    );
  });

  it("環境変数名を直接ハードコードしていないこと", () => {
    assert.doesNotMatch(buildRs, /env::var\("NPCAP_SDK_DIR"\)/);
  });
});
