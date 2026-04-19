import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const README_PATH = resolve(ROOT, "README.md");
const DEPENDENCY_MATRIX_PATH = resolve(ROOT, "docs", "dependency-matrix.md");

const readme = readFileSync(README_PATH, "utf-8");
const dependencyMatrix = readFileSync(DEPENDENCY_MATRIX_PATH, "utf-8");

function collectPythonFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "*.py"],
    { cwd: ROOT, encoding: "utf-8" },
  ).trim();

  return output ? output.split("\n").sort() : [];
}

describe("Repository cleanup consistency", () => {
  it("不要な生成物ディレクトリがリポジトリに残っていないこと", () => {
    assert.equal(existsSync(resolve(ROOT, "coverage")), false);
    assert.equal(existsSync(resolve(ROOT, "tests", "__pycache__")), false);
    assert.equal(existsSync(resolve(ROOT, "notebooks")), false);
    assert.equal(existsSync(resolve(ROOT, ".python-version")), false);
  });

  it("リポジトリ内に Python ファイルが残っていないこと", () => {
    assert.deepEqual(collectPythonFiles(), []);
  });

  it("README が削除済みノートブックを参照していないこと", () => {
    assert.doesNotMatch(readme, /notebooks\//);
    assert.match(readme, /repoCleanupConsistency\.test\.mjs/);
    assert.doesNotMatch(readme, /pytest/);
    assert.doesNotMatch(readme, /test_build_rs\.py/);
    assert.doesNotMatch(readme, /enable_python_bridge/);
  });

  it("棚卸しドキュメントが Python 残骸を参照していないこと", () => {
    assert.doesNotMatch(dependencyMatrix, /birdclef2026-public-blend-4-model\.ipynb/);
    assert.doesNotMatch(dependencyMatrix, /kernel-metadata\.json/);
    assert.doesNotMatch(dependencyMatrix, /test_build_rs\.py/);
    assert.doesNotMatch(dependencyMatrix, /python-runtime-free/);
    assert.doesNotMatch(dependencyMatrix, /enable_python_bridge/);
    assert.match(dependencyMatrix, /リポジトリ内の Python ファイルは削除済み/);
  });
});
