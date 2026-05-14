import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CI_WORKFLOW_PATH = resolve(import.meta.dirname, "..", ".github", "workflows", "ci.yml");
const RELEASE_WORKFLOW_PATH = resolve(import.meta.dirname, "..", ".github", "workflows", "build-release.yml");
const PACKAGE_JSON_PATH = resolve(import.meta.dirname, "..", "package.json");
const CONTRIBUTING_PATH = resolve(import.meta.dirname, "..", "CONTRIBUTING.md");

const ciWorkflow = readFileSync(CI_WORKFLOW_PATH, "utf-8");
const releaseWorkflow = readFileSync(RELEASE_WORKFLOW_PATH, "utf-8");
const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf-8"));
const contributing = readFileSync(CONTRIBUTING_PATH, "utf-8");

describe("CI workflow consistency", () => {
  it("PR / main push 用の軽量 CI と release workflow が分離されていること", () => {
    assert.match(ciWorkflow, /pull_request:/);
    assert.match(ciWorkflow, /push:/);
    assert.match(ciWorkflow, /branches:\n\s+- main/);
    assert.doesNotMatch(ciWorkflow, /tagName:/);
    assert.doesNotMatch(ciWorkflow, /tauri-apps\/tauri-action/);
    assert.match(releaseWorkflow, /tags:\n\s+- "v\*"/);
  });

  it("frontend と Rust の最低限の検証コマンドを CI で実行すること", () => {
    assert.match(ciWorkflow, /npm run lint/);
    assert.match(ciWorkflow, /npm run build/);
    assert.match(ciWorkflow, /npm test/);
    assert.match(ciWorkflow, /npm run test:consistency/);
    assert.match(ciWorkflow, /cargo check --manifest-path src-tauri\/Cargo\.toml/);
    assert.match(ciWorkflow, /cargo test --manifest-path src-tauri\/Cargo\.toml/);
  });

  it("テスト用 npm scripts と CONTRIBUTING の案内が CI と一致していること", () => {
    assert.equal(packageJson.scripts.test, "vitest run");
    assert.equal(packageJson.scripts["test:consistency"], "node --test tests/*.test.mjs");
    assert.match(contributing, /\.github\/workflows\/ci\.yml/);
    assert.match(contributing, /npm run test:consistency/);
    assert.match(contributing, /cargo test --manifest-path src-tauri\/Cargo\.toml/);
  });
});
