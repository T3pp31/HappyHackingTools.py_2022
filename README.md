# HappyHackingTools

ネットワークセキュリティツールキットのデスクトップアプリケーションです。
ペネトレーションテストやCTFの学習・実践を目的として開発しています。

A desktop network security toolkit built with Rust + Tauri v2 and React/TypeScript frontend, designed for penetration testing and CTF practice.

## 注意事項 / Disclaimer

ペネトレーション・CTF目的に作成しているので、第三者に対する攻撃に使用しないようにしてください。
本レポジトリ所有者はいかなる責任も負いません。

This tool is designed for penetration testing and CTF purposes only, and must not be used for attacks against third parties.
The owner of this repository assumes no responsibility whatsoever.

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| バックエンド | Rust (Edition 2021, MSRV 1.77.2) |
| フレームワーク | Tauri v2 |
| フロントエンド | React 18 + TypeScript 5.6 |
| ビルドツール | Vite 5 |
| ルーティング | React Router v7 |
| テスト | Vitest + Testing Library + happy-dom |
| パケットキャプチャ | pnet / pcap (Npcap SDK) |
| 設定管理 | TOML |

## 機能一覧

| 機能 | 説明 |
|------|------|
| LAN スキャン | ARP を使用したローカルネットワーク内のホスト検出、ベンダー情報の取得 |
| ポートスキャン | 指定ホストのオープンポート検出 |
| ARP スプーフィング | ARP テーブルのポイズニングとパケットスニッフィング |
| バイナリビューア | ファイルのバイナリ表示 |
| CTF ツール | CTF 向けユーティリティ |
| ネットワーク情報 | ネットワークインターフェース情報の表示 |

## ディレクトリ構成

```
HappyHackingTools.py_2022/
├── src/                          # フロントエンド (React/TypeScript)
│   ├── components/               # UI コンポーネント
│   │   ├── ArpSpoof/
│   │   ├── Binary/
│   │   ├── Ctf/
│   │   ├── LanScan/
│   │   ├── Layout/
│   │   ├── PortScan/
│   │   └── common/
│   ├── pages/                    # ページコンポーネント
│   ├── config/                   # フロントエンド設定 (defaults.ts)
│   ├── hooks/                    # カスタム React フック
│   ├── types/                    # TypeScript 型定義
│   └── styles/                   # スタイルシート
├── src-tauri/                    # バックエンド (Rust/Tauri)
│   ├── src/
│   │   ├── commands/             # Tauri コマンド (IPC ハンドラ)
│   │   ├── network/              # ネットワーク処理モジュール
│   │   ├── utils/                # ユーティリティ (バイナリ処理等)
│   │   ├── config.rs             # アプリケーション設定
│   │   ├── error.rs              # エラー型定義
│   │   ├── lib.rs                # Tauri アプリケーション初期化
│   │   └── main.rs               # エントリポイント
│   ├── config/
│   │   └── default.toml          # デフォルト設定ファイル
│   ├── capabilities/             # Tauri v2 権限設定
│   └── tauri.conf.json           # Tauri 設定
├── tests/                        # フロントエンドテスト (Vitest)
├── scripts/                      # ビルドスクリプト
│   └── setup-npcap-sdk.ps1       # Npcap SDK セットアップ
├── package.json
├── vite.config.ts
├── vitest.config.ts
└── tsconfig.json
```

## 動作環境

### 必須要件

- **Node.js** (npm が利用可能であること)
- **Rust** (Edition 2021, MSRV 1.77.2 以上)
- **Npcap** (Windows でパケットキャプチャ機能を使用する場合)
  - Npcap 本体: https://npcap.com/#download
  - Npcap SDK: ビルド時に必要

### Npcap SDK のセットアップ (Windows)

Npcap SDK は以下のいずれかの方法で配置してください。

1. 環境変数 `NPCAP_SDK_DIR` に SDK ルートディレクトリを設定する
2. 以下のいずれかのパスに配置する:
   - `C:\npcap-sdk\Lib\x64`
   - `C:\Program Files\Npcap SDK\Lib\x64`
   - `%USERPROFILE%\.npcap-sdk\Lib\x64`

または、付属のセットアップスクリプトを使用できます:

```powershell
.\scripts\setup-npcap-sdk.ps1
```

### 対応 OS

- Windows (Npcap 必須)
- Linux / macOS (libpcap が必要)

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 開発サーバーの起動

```bash
npx tauri dev
```

開発モードではフロントエンドは `http://localhost:5173` で動作し、Tauri がネイティブウィンドウで表示します。

### 3. ビルド (リリース)

```bash
npx tauri build
```

ビルド成果物は `src-tauri/target/release/` に出力されます。

## 開発コマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev` | Vite 開発サーバーのみ起動 (フロントエンド単体) |
| `npx tauri dev` | Tauri 開発モード (フロントエンド + バックエンド) |
| `npx tauri build` | リリースビルド |
| `npm run build` | フロントエンドのみビルド |
| `npm run lint` | ESLint によるコード検査 |
| `npx vitest` | テスト実行 |
| `npx vitest --coverage` | カバレッジ付きテスト実行 |

## 設定

アプリケーションの設定は `src-tauri/config/default.toml` で管理されています。

| セクション | 設定項目 | 説明 |
|-----------|---------|------|
| `[scan]` | `arp_timeout_ms` | ARP 応答タイムアウト (ms) |
| `[scan]` | `arp_retry_count` | ARP リトライ回数 |
| `[scan]` | `port_scan_timeout_ms` | ポートスキャンタイムアウト (ms) |
| `[scan]` | `port_scan_concurrency` | ポートスキャン同時接続数 |
| `[scan]` | `sniff_timeout_sec` | スニッフィングタイムアウト (秒) |
| `[scan]` | `poison_interval_sec` | ARP ポイズニング間隔 (秒) |
| `[vendor]` | `api_url` | MAC ベンダー API の URL |
| `[vendor]` | `use_local_oui` | ローカル OUI データベースの使用 |
| `[paths]` | `pcap_output_dir` | キャプチャファイル出力先 |
| `[paths]` | `pcap_filename` | キャプチャファイル名 |

### 機能フラグ（段階移行）

Python/外部CLI依存を段階的に削減するため、以下のフラグを用意しています。

- Cargo feature（`src-tauri/Cargo.toml`）
  - `python-runtime-free`（デフォルト）
  - `external-cli-fallback`（必要時のみ有効化）
- 設定ファイル（`src-tauri/config/default.toml`）
  - `[feature_flags] prefer_rust_implementation`
  - `[feature_flags] enable_python_bridge`
  - `[network] enable_external_cli_fallback`

依存棚卸しと置換計画は `docs/dependency-matrix.md` を参照してください。

## リリース判定

リリース判定条件として **「追加インストール不要」** を必須とします。

- デフォルトビルド/デフォルト設定で Python ランタイム不要
- 初回起動時に Python / pip の追加インストール不要
