import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const README_PATH = resolve(import.meta.dirname, "..", "README.md");
const readme = readFileSync(README_PATH, "utf-8");

describe("README consistency", () => {
  it("一般利用者向けの Windows 配布導線が記載されていること", () => {
    assert.match(readme, /HappyHackingTools-bootstrapper\.exe/);
    assert.match(readme, /GitHub Releases/);
    assert.match(readme, /Npcap は初回必須ではありません/);
    assert.match(readme, /CONTRIBUTING\.md/);
  });

  it("主要な設定項目が README に記載されていること", () => {
    assert.match(readme, /reset_packet_count/);
    assert.match(readme, /progress_report_interval/);
    assert.match(readme, /lan_scan_arp_retry_count/);
    assert.match(readme, /api_timeout_ms/);
    assert.match(readme, /user_agent/);
    assert.match(readme, /udp_probe_target/);
    assert.match(readme, /enable_external_cli_fallback/);
    assert.match(readme, /prefer_rust_implementation/);
    assert.match(readme, /enable_python_bridge/);
  });

  it("権限設定の説明が現行実装と一致していること", () => {
    assert.match(readme, /core:default/);
    assert.match(readme, /dialog:allow-open/);
    assert.match(readme, /shell:allow-open/);
    assert.match(readme, /shell\.open/);
    assert.match(readme, /https:\/\/npcap\.com\/#download/);
  });

  it("テスト構成の説明に補助テストが含まれていること", () => {
    assert.match(readme, /Vitest \+ Testing Library \+ happy-dom \/ pytest \/ node:test/);
    assert.match(readme, /uv run pytest tests\/test_build_rs\.py -v/);
    assert.match(readme, /node --test tests\/readmeConsistency\.test\.mjs/);
    assert.match(readme, /node --test tests\/buildDelayLoadConsistency\.test\.mjs/);
    assert.match(readme, /node --test tests\/releaseWorkflowConsistency\.test\.mjs/);
    assert.match(readme, /node --test tests\/repoCleanupConsistency\.test\.mjs/);
    assert.match(readme, /cargo test --manifest-path tools\/windows-bootstrapper\/Cargo\.toml/);
    assert.match(readme, /Vitest \/ node:test \/ 補助検証テスト/);
  });

  it("Npcap 未導入時でも起動は維持する前提が記載されていること", () => {
    assert.match(readme, /アプリ起動自体は可能/);
    assert.match(readme, /wpcap\.dll/);
    assert.match(readme, /Packet\.dll/);
  });
});
