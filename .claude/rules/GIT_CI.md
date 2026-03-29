# Git / CI 規約

## ブランチ戦略

| ブランチ | 用途 | 命名例 |
|---------|------|--------|
| `main` | 安定版。直接 push 禁止、PR 経由でマージ | — |
| `feat/{name}` | 新機能開発 | `feat/binary-viewer` |
| `fix/{name}` | バグ修正 | `fix/npcap-dialog-show-link` |
| `refactor/{name}` | リファクタリング | `refactor/remove-npcap-from-lanscan` |
| `test/{name}` | テスト追加・修正 | `test/port-scan-validation` |
| `docs/{name}` | ドキュメント更新 | `docs/update-readme` |

## コミットメッセージ

Conventional Commits 形式を使用すること:

| プレフィックス | 用途 | 例 |
|-------------|------|-----|
| `feat:` | 新機能 | `feat: add binary viewer page` |
| `fix:` | バグ修正 | `fix: NpcapDialogのDownloadボタンをリンク表示に変更` |
| `refactor:` | リファクタリング | `refactor: LanScanPageから不要なNpcapチェックを削除` |
| `test:` | テスト追加・修正 | `test: add NpcapDialog component tests` |
| `docs:` | ドキュメント | `docs: update cross-platform rules` |
| `ci:` | CI/CD 設定 | `ci: add macOS build support` |
| `chore:` | その他雑務 | `chore: update dependencies` |

- 日本語・英語どちらでも可。ただし1コミット内で混在させないこと
- 本文は変更の「なぜ」を記述すること

## プルリクエスト

- PR タイトルはコミットメッセージと同じ Conventional Commits 形式
- PR 本文に変更の概要と影響範囲を記載すること
- セキュリティ関連の変更（新しいネットワーク機能、権限変更）は明示的にレビューを依頼すること

## リリース（CI/CD）

### トリガー

- `v*` タグの push で `build-release.yml` が起動

### ビルド対象

| OS | ランナー |
|----|---------|
| Linux | ubuntu-22.04 |
| macOS | macos-latest |
| Windows | windows-latest |

### バージョニング

- セマンティックバージョニング: `v{MAJOR}.{MINOR}.{PATCH}`
- リリースは Draft 状態で作成され、手動で公開すること

### タグ push 前の確認事項

- [ ] `src-tauri/Cargo.toml` の `version` を更新済み
- [ ] `package.json` の `version` を更新済み
- [ ] `npm run build` がエラーなく通ること
- [ ] フロントエンドテスト（`npx vitest run`）が全パス
- [ ] Rust テスト（`cargo test`）が全パス

### CI 環境の依存関係

| OS | 必要な依存 |
|----|----------|
| Linux | `libwebkit2gtk-4.1-dev`, `libpcap-dev`, `patchelf` 等 |
| macOS | `libpcap`（brew） |
| Windows | Npcap SDK（CI で自動ダウンロード） |
