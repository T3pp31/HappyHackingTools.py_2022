# テスト規約

## テストファイルの配置

- すべてのテストは `tests/` ディレクトリに配置すること
- フロントエンドテスト: `{Component}.test.tsx` または `{module}.test.ts`
- Rust 単体テスト: 各モジュール内に `#[cfg(test)] mod tests` で記述
- Python テスト（ビルドスクリプト検証）: `test_*.py`

## フレームワーク

| レイヤー | フレームワーク | 環境 |
|---------|-------------|------|
| フロントエンド | Vitest + @testing-library/react | happy-dom |
| Rust | 標準テスト (`#[test]`) | — |
| ビルドスクリプト | pytest | Python (uv) |

## テスト実行コマンド

```bash
# フロントエンドテスト
npx vitest run

# カバレッジ付き
npx vitest run --coverage

# Rust テスト
cargo test --manifest-path src-tauri/Cargo.toml

# Python テスト
uv run pytest tests/
```

## テスト記述スタイル

### テスト観点表（必須）

テストファイルの冒頭に等価分割・境界値のテスト観点表をコメントとして記述すること:

```typescript
/**
 * テスト観点表
 * | # | 観点 | 入力 | 期待結果 | 分類 |
 * |---|------|------|---------|------|
 * | 1 | 正常系 | 有効なIP | スキャン成功 | 等価 |
 * | 2 | 異常系 | 不正なIP | エラー表示 | 等価 |
 * | 3 | 境界値 | ポート0 | 正常動作 | 境界 |
 */
```

### Given / When / Then

各テストは Given / When / Then のコメントで構造化すること:

```typescript
it("visible=falseの場合、何もレンダリングされないこと", () => {
  // Given: visible=false で NpcapDialog をレンダリング
  const { container } = render(<NpcapDialog visible={false} />);

  // When: コンテナの中身を確認
  // Then: 何も表示されないこと
  expect(container.innerHTML).toBe("");
});
```

### テスト名

- 日本語で「〜こと」の形式で記述すること
- 例: `有効なIPアドレスでスキャンが成功すること`

## テスト対象の優先順位

1. **共通コンポーネント** (`components/common/`) — 再利用されるため影響範囲が大きい
2. **カスタム Hook** — ビジネスロジックの中核
3. **デフォルト値・設定値** — 正しい値であることの保証
4. **ページコンポーネント** — 結合テスト的な位置づけ

## カバレッジ目標

- 分岐網羅 100% を目指すこと
- 失敗系テストは正常系と同数以上含めること

## テスト網羅要件

以下を必ず網羅すること:

- 正常系（主要シナリオ）
- 異常系（バリデーションエラー、例外）
- 境界値（0, 最小, 最大, ±1, 空, NULL）
- 不正な型・形式の入力
- 外部依存の失敗（該当する場合）
- 例外種別・エラーメッセージの検証

## モック

- Tauri の `invoke` はモックして使用すること（実際のバックエンドに依存しない）
- `vi.fn()` / `vi.mock()` を使用すること
- `afterEach` で `cleanup()` と `vi.clearAllMocks()` を呼ぶこと
