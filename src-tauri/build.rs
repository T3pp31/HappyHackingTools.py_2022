/// Npcap SDK の環境変数名
const NPCAP_SDK_ENV: &str = "NPCAP_SDK_DIR";

/// Windows 向けデフォルト検索パス候補（Lib/x64 サブディレクトリ付き）
#[cfg(target_os = "windows")]
const NPCAP_DEFAULT_SEARCH_PATHS: &[&str] = &[
    r"C:\npcap-sdk\Lib\x64",
    r"C:\Program Files\Npcap SDK\Lib\x64",
];

/// Windows 環境で `USERPROFILE` 配下の候補パスを返す
#[cfg(target_os = "windows")]
fn userprofile_npcap_path() -> Option<std::path::PathBuf> {
    std::env::var("USERPROFILE").ok().map(|home| {
        std::path::PathBuf::from(home)
            .join(".npcap-sdk")
            .join("Lib")
            .join("x64")
    })
}

/// Windows: Npcap SDK の `wpcap.lib` が含まれるディレクトリを検出し、
/// `cargo:rustc-link-search=native=` で出力する。
#[cfg(target_os = "windows")]
fn configure_npcap_link_search() {
    // 環境変数が変更されたら再実行
    println!("cargo:rerun-if-env-changed={NPCAP_SDK_ENV}");

    // 1. 環境変数 NPCAP_SDK_DIR が指定されている場合
    if let Ok(sdk_dir) = std::env::var(NPCAP_SDK_ENV) {
        let lib_path = std::path::PathBuf::from(&sdk_dir)
            .join("Lib")
            .join("x64");
        if lib_path.is_dir() {
            println!(
                "cargo:rustc-link-search=native={}",
                lib_path.display()
            );
            return;
        }
        panic!(
            "環境変数 {NPCAP_SDK_ENV} が設定されていますが、\
             '{path}' が見つかりません。\n\
             Npcap SDK を正しくインストールしてください。",
            path = lib_path.display()
        );
    }

    // 2. デフォルトパス候補を順に探索
    for candidate in NPCAP_DEFAULT_SEARCH_PATHS {
        let path = std::path::Path::new(candidate);
        if path.is_dir() {
            println!("cargo:rustc-link-search=native={candidate}");
            return;
        }
    }

    // 3. %USERPROFILE%\.npcap-sdk\Lib\x64
    if let Some(path) = userprofile_npcap_path() {
        if path.is_dir() {
            println!(
                "cargo:rustc-link-search=native={}",
                path.display()
            );
            return;
        }
    }

    // 見つからなかった場合
    let mut msg = String::from(
        "Npcap SDK の Lib/x64 ディレクトリが見つかりませんでした。\n\
         以下のいずれかの方法で解決してください:\n\n\
         1. 環境変数 NPCAP_SDK_DIR に SDK ルートを設定する\n\
         2. 以下のいずれかのパスに Npcap SDK をインストールする:\n",
    );
    for candidate in NPCAP_DEFAULT_SEARCH_PATHS {
        msg.push_str(&format!("   - {candidate}\n"));
    }
    if let Some(path) = userprofile_npcap_path() {
        msg.push_str(&format!("   - {}\n", path.display()));
    }
    msg.push_str(
        "\nNpcap SDK は https://npcap.com/#download からダウンロードできます。",
    );
    panic!("{msg}");
}

/// Linux / macOS では追加のリンク設定は不要
#[cfg(not(target_os = "windows"))]
fn configure_npcap_link_search() {}

/// Windows: wpcap.dll を遅延ロードに設定し、未インストール時もアプリが起動できるようにする
#[cfg(target_os = "windows")]
fn configure_delay_load() {
    println!("cargo:rustc-link-arg=/DELAYLOAD:wpcap.dll");
    println!("cargo:rustc-link-arg=/DELAYLOAD:Packet.dll");
    println!("cargo:rustc-link-lib=delayimp");
}

/// Linux / macOS では遅延ロード設定は不要
#[cfg(not(target_os = "windows"))]
fn configure_delay_load() {}

fn main() {
    configure_npcap_link_search();
    configure_delay_load();
    tauri_build::build();
}
