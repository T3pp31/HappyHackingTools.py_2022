# Dependency Matrix（Rust移行棚卸し）

最終更新日: 2026-04-19

## 目的

本ドキュメントは、現行機能を以下の2区分で棚卸しし、Rust化の進捗と置換方針を明確化するためのものです。

1. **完全Rust化済み**
2. **外部CLI依存**

また、段階移行のために機能フラグを定義し、最終的に **Pythonランタイム不要ビルド（`python-runtime-free`）をデフォルト** とする方針を管理します。

---

## 呼び出し検索結果（`subprocess` / `python` / `pip`）

### 検索コマンド

```bash
rg -n "subprocess|python3?|pip3?|PyO3|pyo3|std::process::Command::new|child_process|spawn\(" --glob '!coverage/**' --glob '!src-tauri/target/**'
```

### ヒット概要

- `src-tauri/src/network/interface.rs`
  - `netsh` 呼び出し（Windows）
  - `ip -4 addr show` 呼び出し（Linux系）

> 注記: `tokio::spawn` は Rust 非同期タスクであり、Python/外部CLI依存には該当しません。

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

## Python整理メモ

- 旧 Python ノートブックと関連メタデータは、アプリ本体と無関係だったためリポジトリから削除済み
- 現在の Python 利用は `tests/test_build_rs.py` による `build.rs` の構造検証のみ
- **Tauriアプリ本体の実行経路に Python 呼び出しはありません**

## 段階移行フラグ方針

### ビルド時フラグ（Cargo features）

- `python-runtime-free`（**default**）
  - Pythonブリッジを含まないターゲット
- `external-cli-fallback`（opt-in）
  - `netsh` / `ip` を利用するフォールバックを許可

### 実行時フラグ（`default.toml`）

- `[feature_flags]`
  - `prefer_rust_implementation = true`
  - `enable_python_bridge = false`
- `[network]`
  - `enable_external_cli_fallback = false`

### 推奨フェーズ

1. **Phase A（現行）**: Rust実装を優先、CLI fallback はビルド/設定の双方で明示的に有効化した場合のみ使用
2. **Phase B**: Windows/Linux補完ロジックをRustクレートに置換し、`external-cli-fallback` を非推奨化
3. **Phase C**: `external-cli-fallback` 削除、`python-runtime-free` のみを標準配布

---

## リリース判定条件

以下を満たす場合にリリース可とする。

- デフォルト設定・デフォルト機能で Python ランタイム不要
- 初回起動時に Python / pip の追加インストール不要
- 主要機能（LANスキャン、ポートスキャン、ARP、バイナリビューア、ネットワーク情報）が追加インストール不要で動作

### 明文化ルール

**リリース判定条件として「追加インストール不要」を必須項目に設定する。**

