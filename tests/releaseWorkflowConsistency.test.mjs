import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WORKFLOW_PATH = resolve(import.meta.dirname, "..", ".github", "workflows", "build-release.yml");
const CONTRIBUTING_PATH = resolve(import.meta.dirname, "..", "CONTRIBUTING.md");

const workflow = readFileSync(WORKFLOW_PATH, "utf-8");
const contributing = readFileSync(CONTRIBUTING_PATH, "utf-8");

describe("Release workflow consistency", () => {
  it("Windows bootstrapper のビルドと release 添付が workflow に含まれること", () => {
    assert.match(workflow, /Build Windows bootstrapper/);
    assert.match(workflow, /BOOTSTRAPPER_RELEASE_TAG/);
    assert.match(workflow, /HappyHackingTools-bootstrapper\.exe/);
    assert.match(workflow, /softprops\/action-gh-release@v2/);
  });

  it("Windows release body が bootstrapper 推奨と Npcap 導線を説明していること", () => {
    assert.match(workflow, /Windows を利用する一般ユーザーは/);
    assert.match(workflow, /HappyHackingTools-bootstrapper\.exe/);
    assert.match(workflow, /Npcap は初回必須ではなく/);
  });
});

describe("Contributing guide consistency", () => {
  it("Windows 開発に必要な前提と手順が CONTRIBUTING に含まれること", () => {
    assert.match(contributing, /Npcap SDK/);
    assert.match(contributing, /setup-npcap-sdk\.ps1/);
    assert.match(contributing, /npm ci/);
    assert.match(contributing, /npx tauri dev/);
    assert.match(contributing, /npx tauri build/);
  });

  it("一般利用者向けと開発者向けの責務が分離されていること", () => {
    assert.match(contributing, /一般利用者向けのインストール方法は/);
    assert.match(contributing, /README\.md/);
    assert.match(contributing, /Npcap.*本体は ARP Spoof など/);
    assert.match(contributing, /libpcap/);
  });
});
