import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const README_PATH = resolve(ROOT, "README.md");
const GITIGNORE_PATH = resolve(ROOT, ".gitignore");
const DEPENDENCY_MATRIX_PATH = resolve(ROOT, "docs", "dependency-matrix.md");

const readme = readFileSync(README_PATH, "utf-8");
const gitignore = readFileSync(GITIGNORE_PATH, "utf-8");
const dependencyMatrix = readFileSync(DEPENDENCY_MATRIX_PATH, "utf-8");

describe("Repository cleanup consistency", () => {
  it("不要な生成物ディレクトリがリポジトリに残っていないこと", () => {
    assert.equal(existsSync(resolve(ROOT, "coverage")), false);
    assert.equal(existsSync(resolve(ROOT, "tests", "__pycache__")), false);
    assert.equal(existsSync(resolve(ROOT, "notebooks")), false);
  });

  it("生成物と Python キャッシュが .gitignore で除外されていること", () => {
    assert.match(gitignore, /^coverage\/$/m);
    assert.match(gitignore, /^\.pytest_cache\/$/m);
    assert.match(gitignore, /^__pycache__\/$/m);
    assert.match(gitignore, /^\*\.py\[cod\]$/m);
  });

  it("README が削除済みノートブックを参照していないこと", () => {
    assert.doesNotMatch(readme, /notebooks\//);
    assert.match(readme, /repoCleanupConsistency\.test\.mjs/);
  });

  it("棚卸しドキュメントが削除済みノートブックを参照していないこと", () => {
    assert.doesNotMatch(dependencyMatrix, /birdclef2026-public-blend-4-model\.ipynb/);
    assert.doesNotMatch(dependencyMatrix, /kernel-metadata\.json/);
    assert.match(dependencyMatrix, /Tauriアプリ本体の実行経路に Python 呼び出しはありません/);
  });
});
