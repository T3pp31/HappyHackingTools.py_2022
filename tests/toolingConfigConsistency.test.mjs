import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PACKAGE_JSON_PATH = resolve(ROOT, "package.json");
const TSCONFIG_PATH = resolve(ROOT, "tsconfig.json");

const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf-8"));
const tsconfig = JSON.parse(readFileSync(TSCONFIG_PATH, "utf-8"));

describe("Tooling config consistency", () => {
  it("tooling ディレクトリ配下に設定ファイルが存在すること", () => {
    assert.equal(existsSync(resolve(ROOT, "tooling", "vite.config.ts")), true);
    assert.equal(existsSync(resolve(ROOT, "tooling", "vitest.config.ts")), true);
    assert.equal(existsSync(resolve(ROOT, "tooling", "tsconfig.app.json")), true);
    assert.equal(existsSync(resolve(ROOT, "tooling", "tsconfig.node.json")), true);
  });

  it("package scripts が tooling 配下の設定ファイルを参照していること", () => {
    assert.match(packageJson.scripts.dev, /tooling\/vite\.config\.ts/);
    assert.match(packageJson.scripts.build, /tooling\/vite\.config\.ts/);
    assert.match(packageJson.scripts.preview, /tooling\/vite\.config\.ts/);
    assert.match(packageJson.scripts.test, /tooling\/vitest\.config\.ts/);
    assert.match(packageJson.scripts.testCoverage ?? packageJson.scripts["test:coverage"], /tooling\/vitest\.config\.ts/);
  });

  it("root の tsconfig が tooling 配下の tsconfig を参照していること", () => {
    assert.deepEqual(tsconfig.references, [
      { path: "./tooling/tsconfig.app.json" },
      { path: "./tooling/tsconfig.node.json" },
    ]);
  });

  it("旧配置の root 設定ファイルが残っていないこと", () => {
    assert.equal(existsSync(resolve(ROOT, "vite.config.ts")), false);
    assert.equal(existsSync(resolve(ROOT, "vitest.config.ts")), false);
    assert.equal(existsSync(resolve(ROOT, "tsconfig.app.json")), false);
    assert.equal(existsSync(resolve(ROOT, "tsconfig.node.json")), false);
  });
});
