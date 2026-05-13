# Contributing

HappyHackingTools の開発者向けセットアップ手順です。  
一般利用者向けのインストール方法は [README.md](./README.md) を参照してください。

## 前提

- Node.js
- Rust 1.77.2 以上
- Windows で Tauri をビルドする場合は Npcap SDK
- Linux / macOS では `libpcap`

## Windows 開発セットアップ

1. 依存をインストールします。

```powershell
npm ci
```

2. Npcap SDK をセットアップします。

```powershell
.\scripts\setup-npcap-sdk.ps1
```

3. 開発モードを起動します。

```powershell
npx tauri dev
```

4. リリースビルドを作る場合は以下を使います。

```powershell
npx tauri build
```

補足:

- `Npcap SDK` は Windows 開発・ビルド時に必要です。
- 一般利用者向け配布物には `Npcap SDK` は不要です。
- `Npcap` 本体は ARP Spoof など Npcap 依存機能を使う時のみ必要で、アプリ起動自体は未導入でも維持されます。

## Linux / macOS 開発セットアップ

Linux / macOS では `libpcap` を先に入れてから依存を解決してください。

```bash
npm ci
npx tauri dev
```

## テスト

PR / `main` push では `.github/workflows/ci.yml` が軽量 CI として動作し、リリース成果物を作る `.github/workflows/build-release.yml` とは分離しています。

ローカルでも PR 前に最低限以下を確認してください。

```bash
npm run lint
npm run build
npm test
npm run test:consistency
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

Windows bootstrapper を変更した場合は、追加で以下を実行してください。

```bash
cargo test --manifest-path tools/windows-bootstrapper/Cargo.toml
```
