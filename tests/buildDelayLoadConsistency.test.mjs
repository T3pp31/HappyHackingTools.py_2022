import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BUILD_RS_PATH = resolve(import.meta.dirname, "..", "src-tauri", "build.rs");
const buildRs = readFileSync(BUILD_RS_PATH, "utf-8");

describe("build.rs delay-load consistency", () => {
  it("Windows 向け遅延ロード対象 DLL が定数で管理されていること", () => {
    assert.match(buildRs, /const\s+WINDOWS_DELAY_LOAD_DLLS\s*:\s*&\[\&str\]/);
    assert.match(buildRs, /"wpcap\.dll"/);
    assert.match(buildRs, /"Packet\.dll"/);
  });

  it("configure_delay_load が定数一覧を使って /DELAYLOAD を設定すること", () => {
    assert.match(buildRs, /for\s+dll_name\s+in\s+WINDOWS_DELAY_LOAD_DLLS\s*\{/);
    assert.match(buildRs, /cargo:rustc-link-arg=\/DELAYLOAD:\{dll_name\}/);
    assert.match(buildRs, /cargo:rustc-link-lib=delayimp/);
  });

  it("main 関数から configure_delay_load が呼ばれていること", () => {
    assert.match(buildRs, /fn\s+main\s*\(\)\s*\{[\s\S]*configure_delay_load\(\);[\s\S]*\}/);
  });
});
