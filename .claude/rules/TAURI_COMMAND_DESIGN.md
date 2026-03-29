# Tauri コマンド設計規約

Tauri v2 のコマンド定義・状態管理・イベント通信に関する規約。

## コマンド定義パターン

- `#[tauri::command]` 関数は `commands/` ディレクトリに機能単位のファイルで配置すること
- コマンド関数は薄いアダプター層とし、実装ロジックは `network/` や `utils/` に委譲すること
- 新規コマンド追加時は `lib.rs` の `invoke_handler` に登録を忘れないこと
- コマンドの戻り値型は `Result<T, AppError>` で統一すること
- レスポンス構造体には `#[derive(Debug, Serialize, Clone)]` を付与すること

## 状態管理（AppState）

- アプリケーション全体の共有状態は `AppState` 構造体に集約すること
- 現在のフィールド構成:

| フィールド | 型 | 用途 |
|-----------|-----|------|
| `config` | `AppConfig` | TOML 設定値 |
| `http_client` | `reqwest::Client` | HTTP クライアント（再利用） |
| `arp_spoof_running` | `Arc<Mutex<bool>>` | 長時間実行タスクの制御フラグ |

- 新しい共有状態が必要な場合は `AppState` にフィールドを追加すること
- コマンド関数では `state: tauri::State<'_, AppState>` で注入すること

## イベント通信

- バックエンド → フロントエンドのリアルタイム通知には `window.emit("event-name", payload)` を使用すること
- イベント名はケバブケース（例: `port-found`, `scan-progress`）で統一すること
- ペイロードは `serde_json::json!({...})` で構築すること
- 進捗通知は `config/default.toml` の `progress_report_interval` に基づいた間隔で発行し、フラッディングを防止すること

## Capabilities（権限制御）

- `src-tauri/capabilities/default.json` で必要最小限の権限のみ許可すること
- 新しい Tauri プラグインを追加した場合は capabilities の更新を忘れないこと
- 不要な権限は付与しないこと（最小権限の原則）

## 設定管理

- アプリケーション設定は `config/default.toml` で一元管理すること
- `AppConfig` は `config.rs` で定義し、TOML ファイルからロードすること
- デフォルト値はコード内の `Default` トレイト実装で提供すること
- 設定値のロード順: 実行ファイルディレクトリ → 作業ディレクトリ → コード内デフォルト
