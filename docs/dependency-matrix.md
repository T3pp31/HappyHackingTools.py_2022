# Dependency Matrix（Rust移行棚卸し）

最終更新日: 2026-04-19

## 目的

本ドキュメントは、現行機能を以下の2区分で棚卸しし、Rust化完了後に残っている依存だけを明確化するためのものです。

1. **完全Rust化済み**
2. **外部CLI依存**

現在、アプリ本体は Rust + Tauri に統一されており、残る移行課題は外部CLIフォールバックの整理です。

---

## 呼び出し検索結果（外部CLI / child process）

### 検索コマンド

```bash
rg -n "std::process::Command::new|child_process|spawn\(" --glob '!coverage/**' --glob '!src-tauri/target/**'
```

### ヒット概要

- `src-tauri/src/network/interface.rs`
  - `netsh` 呼び出し（Windows）
  - `ip -4 addr show` 呼び出し（Linux系）

> 注記: `tokio::spawn` は Rust 非同期タスクであり、外部CLI依存には該当しません。

---

## 2区分棚卸し

## 1) 完全Rust化済み

| 機能 | 実装 | 備考 |
|---|---|---|
| LANスキャン | Rust (`pnet`, `pcap`) | Npcap/libpcap はOS依存ライブラリとして扱う |
| ポートスキャン | Rust (Tokio TCP) | Python非依存 |
| ARPスプーフィング | Rust (`pnet`, `pcap`) | Python非依存 |
| バイナリビューア | Rust + Tauri command | Python非依存 |
| Npcapチェック | Rust | Python非依存 |

## 2) 外部CLI依存

| 箇所 | コマンド | 現在の用途 | 優先度 | Rustクレート置換方針 |
|---|---|---|---|---|
| `src-tauri/src/network/interface.rs`（Windows） | `netsh interface ipv4 show addresses` | インターフェース名/マスク/GW補完 | 中 | `default-net`/`network-interface` などで情報取得を統一し CLI 依存を撤去 |
| `src-tauri/src/network/interface.rs`（Linux） | `ip -4 addr show` | インターフェース名補完 | 中 | `rtnetlink` または `nix` + netlink 実装へ置換 |

---

## Rust移行メモ

- アプリ本体の実行経路は Rust + Tauri のみ
- `build.rs` の構造検証も `node:test` に移行済み
- リポジトリ内の Python ファイルは削除済み

## 段階移行フラグ方針

### ビルド時フラグ（Cargo features）

- `external-cli-fallback`（opt-in）
  - `netsh` / `ip` を利用するフォールバックを許可

### 実行時フラグ（`default.toml`）

- `[feature_flags]`
  - `prefer_rust_implementation = true`
- `[network]`
  - `enable_external_cli_fallback = false`

### 推奨フェーズ

1. **Phase A（現行）**: Rust実装を優先し、CLI fallback はビルド/設定の双方で明示的に有効化した場合のみ使用
2. **Phase B**: Windows/Linux補完ロジックをRustクレートに置換し、`external-cli-fallback` を非推奨化
3. **Phase C**: `external-cli-fallback` を削除し、完全Rust構成のみを標準配布

---

## リリース判定条件

以下を満たす場合にリリース可とする。

- デフォルト設定・デフォルト機能で追加ランタイム不要
- 初回起動時に補助言語ランタイムの追加インストール不要
- 主要機能（LANスキャン、ポートスキャン、ARP、バイナリビューア、ネットワーク情報）が追加インストール不要で動作

### 明文化ルール

**リリース判定条件として「追加インストール不要」を必須項目に設定する。**

