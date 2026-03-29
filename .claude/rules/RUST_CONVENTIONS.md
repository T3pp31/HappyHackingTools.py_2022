# Rust コーディング規約

本プロジェクトの Rust コード（`src-tauri/src/`）に適用する規約。

## エラーハンドリング

- すべてのエラーは `error.rs` の `AppError` 列挙型に集約すること
- 新機能追加時は `AppError` にバリアントを追加し、`#[error("...")]` で人間可読なメッセージを付与すること
- コマンド関数の戻り値は `Result<T, AppError>` を使用すること（`CommandResult<T>` エイリアス可）
- `unwrap()` / `expect()` は本番コードで使用禁止。テストコードでのみ許可
- 外部クレートのエラーは `map_err` で `AppError` に変換すること
- `#[from]` 自動変換は `std::io::Error` など汎用的なもののみに限定

## モジュール構造

| レイヤー | ディレクトリ | 責務 |
|---------|------------|------|
| Command | `commands/` | `#[tauri::command]` 関数。入力バリデーションと実装レイヤーへの委譲のみ |
| 実装 | `network/` | ネットワーク処理ロジック。Tauri依存は `Window`（イベント発行用）のみ許可 |
| ユーティリティ | `utils/` | ドメイン非依存の汎用処理 |
| 設定 | `config.rs` | TOML設定ファイルの読み込みと `AppConfig` 構造体の管理 |
| エラー | `error.rs` | カスタムエラー型 `AppError` の定義 |

- 各ディレクトリには `mod.rs` を配置し、公開モジュールを明示すること
- Command レイヤーにビジネスロジックを書かないこと

## 命名規則

| 対象 | 規則 | 例 |
|------|------|-----|
| ファイル名 | `snake_case` | `port_scan.rs`, `arp_spoof.rs` |
| 関数名・変数名 | `snake_case` | `get_active_network_info`, `lookup_vendor` |
| 型名（struct / enum） | `PascalCase` | `AppError`, `NetworkInfo`, `PortScanResult` |
| 定数 | `SCREAMING_SNAKE_CASE` | `MAC_ADDR_LEN`, `DEFAULT_PREFIX_LEN` |
| コマンド関数名 | フロントエンドの `invoke` 名と一致 | `port_scan` → `invoke("port_scan")` |

## 非同期パターン

- 非同期ランタイムは **Tokio** を使用すること
- 共有状態は `Arc<Mutex<T>>` で管理すること（参考: `arp_spoof_running` フラグ）
- 長時間実行タスクは `tokio::spawn` で別タスクに分離し、状態フラグで制御すること
- 並行数制限には `tokio::sync::Semaphore` を使用すること（参考: `port_scan` の実装）
- セマフォの並行数は `config/default.toml` の設定値を使用し、ハードコードしないこと

## ログ出力

- `log` クレートのマクロ（`info!`, `warn!`, `error!`）を使用すること
- エラー発生時は `log::error!` で記録した上で `AppError` を返すこと
- `println!` / `eprintln!` は本番コードで使用禁止
- ログメッセージには処理のコンテキスト情報（IP、ポート番号、インターフェース名等）を含めること

## feature フラグ

- Npcap / pcap 依存機能は `#[cfg(feature = "npcap")]` で囲むこと
- `npcap` フィーチャー無効時はスタブ実装（エラーを返す）を用意すること
- デフォルトビルド（`default = []`）は `npcap` フィーチャーなしで成功すること
