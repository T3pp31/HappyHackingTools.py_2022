"""
build.rs の Npcap SDK リンク検出ロジックに関するテスト。

build.rs はビルドスクリプトのため cargo test では直接実行できない。
このテストではファイル内容の構造的検証を行う。

テスト観点:
| 観点                  | 等価クラス         | 境界値       |
|-----------------------|--------------------|-------------|
| cfg(windows) ガード   | 存在する/しない     | -           |
| cfg(not(windows))     | 存在する/しない     | -           |
| 環境変数参照           | NPCAP_SDK_DIR      | -           |
| デフォルトパス候補      | 3候補すべて記載     | -           |
| rerun-if-env-changed  | 出力がある         | -           |
| パニックメッセージ      | エラー説明あり      | -           |
| tauri_build::build()  | main で呼ばれる    | -           |
| ハードコード禁止       | 定数利用           | -           |

実行コマンド:
    uv run pytest tests/test_build_rs.py -v

カバレッジ:
    uv run pytest tests/test_build_rs.py -v --tb=short
"""

import pathlib
import re

import pytest

BUILD_RS_PATH = pathlib.Path(__file__).resolve().parent.parent / "src-tauri" / "build.rs"


@pytest.fixture
def build_rs_content() -> str:
    """Given: build.rs ファイルが存在する"""
    assert BUILD_RS_PATH.exists(), f"build.rs not found at {BUILD_RS_PATH}"
    return BUILD_RS_PATH.read_text(encoding="utf-8")


# ===== 正常系 =====


class TestBuildRsStructure:
    """build.rs の構造的な正しさを検証する"""

    def test_main_calls_tauri_build(self, build_rs_content: str):
        """
        Given: build.rs が存在する
        When: main 関数の内容を確認する
        Then: tauri_build::build() が呼ばれている
        """
        assert "tauri_build::build()" in build_rs_content

    def test_main_calls_configure_npcap(self, build_rs_content: str):
        """
        Given: build.rs が存在する
        When: main 関数の内容を確認する
        Then: configure_npcap_link_search() が呼ばれている
        """
        assert "configure_npcap_link_search()" in build_rs_content

    def test_has_windows_cfg_guard(self, build_rs_content: str):
        """
        Given: build.rs が存在する
        When: Windows 用 cfg ガードを確認する
        Then: cfg(target_os = "windows") が存在する
        """
        assert 'cfg(target_os = "windows")' in build_rs_content

    def test_has_not_windows_cfg_guard(self, build_rs_content: str):
        """
        Given: build.rs が存在する
        When: 非 Windows 用 cfg ガードを確認する
        Then: cfg(not(target_os = "windows")) が存在する
        """
        assert 'cfg(not(target_os = "windows"))' in build_rs_content

    def test_rerun_if_env_changed(self, build_rs_content: str):
        """
        Given: build.rs が存在する
        When: cargo rerun ディレクティブを確認する
        Then: rerun-if-env-changed=NPCAP_SDK_DIR が出力される
        """
        assert "cargo:rerun-if-env-changed=" in build_rs_content
        assert "NPCAP_SDK_DIR" in build_rs_content

    def test_link_search_directive(self, build_rs_content: str):
        """
        Given: build.rs が存在する
        When: リンクサーチディレクティブを確認する
        Then: cargo:rustc-link-search=native= が使われている
        """
        assert "cargo:rustc-link-search=native=" in build_rs_content


class TestDefaultPaths:
    """デフォルトパス候補の検証"""

    def test_has_c_npcap_sdk_path(self, build_rs_content: str):
        """
        Given: build.rs が存在する
        When: デフォルトパス候補を確認する
        Then: C:\\npcap-sdk\\Lib\\x64 が候補に含まれる
        """
        assert r"C:\npcap-sdk\Lib\x64" in build_rs_content

    def test_has_program_files_path(self, build_rs_content: str):
        """
        Given: build.rs が存在する
        When: デフォルトパス候補を確認する
        Then: C:\\Program Files\\Npcap SDK\\Lib\\x64 が候補に含まれる
        """
        assert r"C:\Program Files\Npcap SDK\Lib\x64" in build_rs_content

    def test_has_userprofile_path(self, build_rs_content: str):
        """
        Given: build.rs が存在する
        When: USERPROFILE ベースのパスを確認する
        Then: .npcap-sdk パスが USERPROFILE 環境変数から構築される
        """
        assert "USERPROFILE" in build_rs_content
        assert ".npcap-sdk" in build_rs_content


class TestConstantDefinitions:
    """定数定義の検証（ハードコード禁止ルール準拠）"""

    def test_env_var_name_is_constant(self, build_rs_content: str):
        """
        Given: build.rs が存在する
        When: 環境変数名の定義を確認する
        Then: NPCAP_SDK_ENV が定数として定義されている
        """
        assert re.search(
            r'const\s+NPCAP_SDK_ENV\s*:\s*&str\s*=\s*"NPCAP_SDK_DIR"',
            build_rs_content,
        )

    def test_default_paths_is_constant(self, build_rs_content: str):
        """
        Given: build.rs が存在する
        When: デフォルトパスの定義を確認する
        Then: NPCAP_DEFAULT_SEARCH_PATHS が定数として定義されている
        """
        assert re.search(
            r"const\s+NPCAP_DEFAULT_SEARCH_PATHS\s*:\s*&\[&str\]",
            build_rs_content,
        )


# ===== 異常系 =====


class TestErrorHandling:
    """エラーハンドリングの検証"""

    def test_panic_on_not_found(self, build_rs_content: str):
        """
        Given: build.rs が存在する
        When: パス未検出時の処理を確認する
        Then: panic! マクロが使われている
        """
        assert "panic!" in build_rs_content

    def test_error_message_contains_download_url(self, build_rs_content: str):
        """
        Given: build.rs が存在する
        When: エラーメッセージを確認する
        Then: Npcap SDK のダウンロード URL が含まれている
        """
        assert "npcap.com" in build_rs_content

    def test_error_message_for_invalid_env_var(self, build_rs_content: str):
        """
        Given: build.rs が存在する
        When: 環境変数が無効なパスを指している場合の処理を確認する
        Then: 環境変数設定済みだがパスが無い場合のエラーメッセージがある
        """
        # 環境変数が設定されているが Lib/x64 が見つからない場合の panic
        assert re.search(
            r"panic!\s*\(",
            build_rs_content,
        )
        # 2つの panic! があるはず（環境変数パス不正 + 全候補未検出）
        panic_count = len(re.findall(r"panic!\s*\(", build_rs_content))
        assert panic_count >= 2, f"Expected at least 2 panic! calls, found {panic_count}"


class TestNonWindowsBehavior:
    """非 Windows 環境での動作検証"""

    def test_non_windows_function_is_empty(self, build_rs_content: str):
        """
        Given: build.rs が存在する
        When: 非 Windows 用の configure_npcap_link_search を確認する
        Then: 空の関数体である
        """
        # cfg(not(target_os = "windows")) の後に空関数がある
        pattern = r'#\[cfg\(not\(target_os\s*=\s*"windows"\)\)\]\s*fn\s+configure_npcap_link_search\s*\(\s*\)\s*\{\s*\}'
        assert re.search(pattern, build_rs_content), (
            "非 Windows 用の configure_npcap_link_search が空関数として定義されていません"
        )


# ===== 境界値 =====


class TestBuildRsFile:
    """ファイル自体の境界値テスト"""

    def test_file_is_not_empty(self, build_rs_content: str):
        """
        Given: build.rs が存在する
        When: ファイル内容を確認する
        Then: 空でない
        """
        assert len(build_rs_content.strip()) > 0

    def test_file_is_valid_utf8(self):
        """
        Given: build.rs ファイルパスが存在する
        When: UTF-8 として読み込む
        Then: エラーなく読める
        """
        # 例外が出なければ OK
        BUILD_RS_PATH.read_text(encoding="utf-8")

    def test_file_does_not_contain_hardcoded_env_read(self, build_rs_content: str):
        """
        Given: build.rs が存在する
        When: 環境変数の直接文字列使用を確認する
        Then: env::var に直接 "NPCAP_SDK_DIR" を渡していない（定数経由である）
        """
        # env::var("NPCAP_SDK_DIR") のような直接指定がないことを確認
        # 代わりに env::var(NPCAP_SDK_ENV) を使っているはず
        assert 'env::var("NPCAP_SDK_DIR")' not in build_rs_content
