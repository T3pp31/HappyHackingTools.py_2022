# TypeScript / React コーディング規約

本プロジェクトのフロントエンドコード（`src/`）に適用する規約。

## ディレクトリ構造

| ディレクトリ | 役割 | 命名規則 |
|------------|------|---------|
| `pages/` | ページコンポーネント（ルーティング単位） | `{Feature}Page.tsx` |
| `components/common/` | 再利用可能な共通コンポーネント | `{Name}.tsx` |
| `components/{Feature}/` | 機能固有のコンポーネント群 | `{Name}.tsx` |
| `hooks/` | カスタム Hook | `use{Name}.ts` |
| `types/` | TypeScript 型定義 | `index.ts` に集約 |
| `config/` | デフォルト値・定数 | `defaults.ts` |
| `styles/` | 共通スタイルオブジェクト | `{name}Styles.ts` |

## Tauri コマンド呼び出し

- Tauri コマンドの呼び出しには `useTauriCommand<T>` 汎用 Hook を使用すること
- 機能固有の複合操作は専用 Hook（例: `useArpSpoof`）でラップすること
- ページコンポーネントから直接 `invoke` を呼ばないこと
- コマンド名はスネークケースで記述し、Rust 側の関数名と完全一致させること
- コマンド引数のキー名は Rust 側のパラメータ名（スネークケース）に合わせること

## 型定義

- Rust 側の Serialize 構造体と対応する TypeScript 型を `types/index.ts` に定義すること
- `any` 型は使用禁止。`unknown` + 型ガードまたは適切な型パラメータを使用すること
- Rust のフィールド名（`snake_case`）をそのまま TypeScript の型で使用すること（`camelCase` に変換しない）
- ジェネリック型を活用して再利用性を確保すること（参考: `DataTable<T>`, `useTauriCommand<T>`）

## コンポーネント設計

- 関数コンポーネント + `React.FC` 型アノテーションを使用すること
- Named export を使用すること（`default export` は `App.tsx` のみ例外）
- Props 型は `interface {Component}Props` で定義すること
- 状態管理は `useState` / カスタム Hook で行い、外部状態管理ライブラリは使用しないこと
- ローディング状態とエラー状態は `LoadingSpinner` / `ErrorMessage` コンポーネントで表示すること

## スタイリング

- テーマ値（色、角丸、余白）は CSS 変数（`var(--accent)`, `var(--bg-secondary)` 等）を使用すること
- 共通スタイルは `styles/formStyles.ts` に `React.CSSProperties` オブジェクトとして定義すること
- インラインスタイルでハードコードされた色を使用しないこと
- グローバルスタイルは `styles/global.css` で管理すること

## デフォルト値

- フォーム初期値などのデフォルト値は `config/defaults.ts` に定数として集約すること
- ページコンポーネント内にマジックナンバーやデフォルト文字列を直書きしないこと
- デフォルト値の定数名は `{FEATURE}_DEFAULTS` の形式とすること（例: `PORT_SCAN_DEFAULTS`）
