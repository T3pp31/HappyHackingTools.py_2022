use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT};
use serde::Deserialize;
use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus};
use std::time::Duration;
use thiserror::Error;

const RAW_CONFIG: &str = include_str!("../config/bootstrapper.toml");
const RELEASE_TAG_LATEST: &str = "latest";
const CANCELLED_MSI_EXIT_CODE: i32 = 1602;

#[derive(Debug, Error)]
pub enum BootstrapperError {
    #[error("bootstrapper config parse error: {0}")]
    ConfigParse(#[from] toml::de::Error),
    #[error("HTTP client init failed: {0}")]
    HttpClient(#[source] reqwest::Error),
    #[error("GitHub release fetch failed: {0}")]
    ReleaseFetch(#[source] reqwest::Error),
    #[error("failed to download installer asset: {0}")]
    AssetDownload(#[source] reqwest::Error),
    #[error("no Windows installer asset found in release")]
    AssetNotFound,
    #[error("unsupported installer format: {0}")]
    UnsupportedInstaller(String),
    #[error("failed to create download directory '{path}': {source}")]
    CreateDirectory { path: PathBuf, source: io::Error },
    #[error("failed to create installer file '{path}': {source}")]
    CreateInstallerFile { path: PathBuf, source: io::Error },
    #[error("failed to write installer file '{path}': {source}")]
    WriteInstallerFile { path: PathBuf, source: io::Error },
    #[error("failed to launch installer: {0}")]
    LaunchInstaller(#[source] io::Error),
    #[error("installer exited with a failure status: {0:?}")]
    InstallerFailed(Option<i32>),
    #[error("failed to open browser: {0}")]
    OpenBrowser(#[source] io::Error),
    #[error("failed to launch installed app: {0}")]
    LaunchApp(#[source] io::Error),
}

#[derive(Debug, Deserialize)]
struct RawBootstrapperConfig {
    app_name: String,
    github_api_base: String,
    repository_owner: String,
    repository_name: String,
    default_release_tag: String,
    user_agent: String,
    download_directory_name: String,
    asset_name_contains: Vec<String>,
    excluded_asset_name_contains: Vec<String>,
    preferred_extensions: Vec<String>,
    launch_candidates: Vec<String>,
    message: BootstrapperMessages,
}

#[derive(Debug, Deserialize, Clone)]
pub struct BootstrapperMessages {
    pub welcome: String,
    pub fetch_release: String,
    pub download_start: String,
    pub download_complete: String,
    pub installer_complete: String,
    pub installer_cancelled: String,
    pub launch_prompt: String,
    pub open_release_prompt: String,
    pub exit_prompt: String,
}

#[derive(Debug, Clone)]
pub struct BootstrapperConfig {
    pub app_name: String,
    pub github_api_base: String,
    pub repository_owner: String,
    pub repository_name: String,
    pub release_tag: String,
    pub user_agent: String,
    pub download_directory_name: String,
    pub asset_name_contains: Vec<String>,
    pub excluded_asset_name_contains: Vec<String>,
    pub preferred_extensions: Vec<String>,
    pub launch_candidates: Vec<String>,
    pub message: BootstrapperMessages,
}

#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
pub struct ReleaseAsset {
    pub name: String,
    pub browser_download_url: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ReleaseMetadata {
    pub html_url: String,
    pub assets: Vec<ReleaseAsset>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstallerTarget {
    pub asset_name: String,
    pub download_url: String,
    pub download_path: PathBuf,
}

pub fn load_config() -> Result<BootstrapperConfig, BootstrapperError> {
    let raw: RawBootstrapperConfig = toml::from_str(RAW_CONFIG)?;
    Ok(BootstrapperConfig {
        app_name: raw.app_name,
        github_api_base: raw.github_api_base,
        repository_owner: option_env!("BOOTSTRAPPER_REPOSITORY_OWNER")
            .unwrap_or(&raw.repository_owner)
            .to_string(),
        repository_name: option_env!("BOOTSTRAPPER_REPOSITORY_NAME")
            .unwrap_or(&raw.repository_name)
            .to_string(),
        release_tag: option_env!("BOOTSTRAPPER_RELEASE_TAG")
            .unwrap_or(&raw.default_release_tag)
            .to_string(),
        user_agent: raw.user_agent,
        download_directory_name: raw.download_directory_name,
        asset_name_contains: raw.asset_name_contains,
        excluded_asset_name_contains: raw.excluded_asset_name_contains,
        preferred_extensions: raw.preferred_extensions,
        launch_candidates: raw.launch_candidates,
        message: raw.message,
    })
}

pub fn build_http_client(config: &BootstrapperConfig) -> Result<Client, BootstrapperError> {
    let mut headers = HeaderMap::new();
    headers.insert(
        ACCEPT,
        HeaderValue::from_static("application/vnd.github+json"),
    );

    reqwest::blocking::Client::builder()
        .default_headers(headers)
        .user_agent(config.user_agent.clone())
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(BootstrapperError::HttpClient)
}

pub fn build_release_api_url(config: &BootstrapperConfig) -> String {
    if config.release_tag.eq_ignore_ascii_case(RELEASE_TAG_LATEST) {
        format!(
            "{}/repos/{}/{}/releases/latest",
            config.github_api_base, config.repository_owner, config.repository_name
        )
    } else {
        format!(
            "{}/repos/{}/{}/releases/tags/{}",
            config.github_api_base,
            config.repository_owner,
            config.repository_name,
            config.release_tag
        )
    }
}

pub fn build_release_page_url(config: &BootstrapperConfig) -> String {
    if config.release_tag.eq_ignore_ascii_case(RELEASE_TAG_LATEST) {
        format!(
            "https://github.com/{}/{}/releases/latest",
            config.repository_owner, config.repository_name
        )
    } else {
        format!(
            "https://github.com/{}/{}/releases/tag/{}",
            config.repository_owner, config.repository_name, config.release_tag
        )
    }
}

pub fn fetch_release_metadata(
    client: &Client,
    config: &BootstrapperConfig,
) -> Result<ReleaseMetadata, BootstrapperError> {
    client
        .get(build_release_api_url(config))
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(BootstrapperError::ReleaseFetch)?
        .json::<ReleaseMetadata>()
        .map_err(BootstrapperError::ReleaseFetch)
}

pub fn select_windows_installer_asset<'a>(
    assets: &'a [ReleaseAsset],
    config: &BootstrapperConfig,
) -> Option<&'a ReleaseAsset> {
    assets
        .iter()
        .filter_map(|asset| {
            let lower = asset.name.to_ascii_lowercase();

            if config
                .excluded_asset_name_contains
                .iter()
                .any(|needle| lower.contains(&needle.to_ascii_lowercase()))
            {
                return None;
            }

            if !config
                .asset_name_contains
                .iter()
                .all(|needle| lower.contains(&needle.to_ascii_lowercase()))
            {
                return None;
            }

            let extension_index = config
                .preferred_extensions
                .iter()
                .position(|ext| lower.ends_with(&ext.to_ascii_lowercase()))?;

            let architecture_bonus = if lower.contains("x64") || lower.contains("x86_64") {
                10usize
            } else {
                0usize
            };

            Some((extension_index * 100usize + architecture_bonus, asset))
        })
        .min_by_key(|(score, _)| *score)
        .map(|(_, asset)| asset)
}

pub fn resolve_installer_target(
    release: &ReleaseMetadata,
    config: &BootstrapperConfig,
) -> Result<InstallerTarget, BootstrapperError> {
    let asset = select_windows_installer_asset(&release.assets, config)
        .ok_or(BootstrapperError::AssetNotFound)?;
    let download_dir = std::env::temp_dir().join(&config.download_directory_name);
    Ok(InstallerTarget {
        asset_name: asset.name.clone(),
        download_url: asset.browser_download_url.clone(),
        download_path: download_dir.join(&asset.name),
    })
}

pub fn download_installer(
    client: &Client,
    target: &InstallerTarget,
) -> Result<(), BootstrapperError> {
    if let Some(parent) = target.download_path.parent() {
        fs::create_dir_all(parent).map_err(|source| BootstrapperError::CreateDirectory {
            path: parent.to_path_buf(),
            source,
        })?;
    }

    let mut response = client
        .get(&target.download_url)
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(BootstrapperError::AssetDownload)?;

    let mut file = File::create(&target.download_path).map_err(|source| {
        BootstrapperError::CreateInstallerFile {
            path: target.download_path.clone(),
            source,
        }
    })?;

    response
        .copy_to(&mut file)
        .map_err(BootstrapperError::AssetDownload)?;
    file.flush()
        .map_err(|source| BootstrapperError::WriteInstallerFile {
            path: target.download_path.clone(),
            source,
        })?;

    Ok(())
}

pub fn launch_installer(installer_path: &Path) -> Result<ExitStatus, BootstrapperError> {
    let extension = installer_path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .ok_or_else(|| {
            BootstrapperError::UnsupportedInstaller(installer_path.display().to_string())
        })?;

    let status = match extension.as_str() {
        "msi" => Command::new("msiexec")
            .arg("/i")
            .arg(installer_path)
            .status()
            .map_err(BootstrapperError::LaunchInstaller)?,
        "exe" => Command::new(installer_path)
            .status()
            .map_err(BootstrapperError::LaunchInstaller)?,
        _ => {
            return Err(BootstrapperError::UnsupportedInstaller(
                installer_path.display().to_string(),
            ))
        }
    };

    if status.success() || status.code() == Some(CANCELLED_MSI_EXIT_CODE) {
        Ok(status)
    } else {
        Err(BootstrapperError::InstallerFailed(status.code()))
    }
}

pub fn installer_was_cancelled(status: &ExitStatus) -> bool {
    status.code() == Some(CANCELLED_MSI_EXIT_CODE)
}

pub fn find_installed_app(config: &BootstrapperConfig) -> Option<PathBuf> {
    config
        .launch_candidates
        .iter()
        .map(|candidate| expand_windows_env_path(candidate))
        .find(|path| path.is_file())
}

pub fn launch_installed_app(path: &Path) -> Result<(), BootstrapperError> {
    Command::new(path)
        .spawn()
        .map(|_| ())
        .map_err(BootstrapperError::LaunchApp)
}

pub fn open_release_page(url: &str) -> Result<(), BootstrapperError> {
    Command::new("cmd")
        .args(["/C", "start", "", url])
        .spawn()
        .map(|_| ())
        .map_err(BootstrapperError::OpenBrowser)
}

pub fn prompt_yes_no(prompt: &str, default_yes: bool) -> bool {
    print!("{prompt}");
    let _ = io::stdout().flush();

    let mut input = String::new();
    if io::stdin().read_line(&mut input).is_err() {
        return default_yes;
    }

    let normalized = input.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return default_yes;
    }

    matches!(normalized.as_str(), "y" | "yes")
}

pub fn wait_for_enter(prompt: &str) {
    print!("{prompt}");
    let _ = io::stdout().flush();
    let mut input = String::new();
    let _ = io::stdin().read_line(&mut input);
}

fn expand_windows_env_path(input: &str) -> PathBuf {
    PathBuf::from(expand_windows_env_path_with_lookup(input, |key| {
        std::env::var(key).ok()
    }))
}

fn expand_windows_env_path_with_lookup<F>(input: &str, lookup: F) -> String
where
    F: Fn(&str) -> Option<String>,
{
    let mut result = String::new();
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch != '%' {
            result.push(ch);
            continue;
        }

        let mut key = String::new();
        while let Some(next) = chars.peek().copied() {
            chars.next();
            if next == '%' {
                break;
            }
            key.push(next);
        }

        if key.is_empty() {
            result.push('%');
            continue;
        }

        if let Some(value) = lookup(&key) {
            result.push_str(&value);
        } else {
            result.push('%');
            result.push_str(&key);
            result.push('%');
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_config() -> BootstrapperConfig {
        BootstrapperConfig {
            app_name: "HappyHackingTools".to_string(),
            github_api_base: "https://api.github.com".to_string(),
            repository_owner: "owner".to_string(),
            repository_name: "repo".to_string(),
            release_tag: "v1.2.3".to_string(),
            user_agent: "bootstrapper-test".to_string(),
            download_directory_name: "HappyHackingTools".to_string(),
            asset_name_contains: vec!["happyhackingtools".to_string()],
            excluded_asset_name_contains: vec!["bootstrapper".to_string()],
            preferred_extensions: vec![".msi".to_string(), ".exe".to_string()],
            launch_candidates: vec![
                "%LOCALAPPDATA%/Programs/HappyHackingTools/HappyHackingTools.exe".to_string(),
            ],
            message: BootstrapperMessages {
                welcome: "welcome".to_string(),
                fetch_release: "fetch".to_string(),
                download_start: "download".to_string(),
                download_complete: "done".to_string(),
                installer_complete: "complete".to_string(),
                installer_cancelled: "cancelled".to_string(),
                launch_prompt: "launch".to_string(),
                open_release_prompt: "open".to_string(),
                exit_prompt: "exit".to_string(),
            },
        }
    }

    #[test]
    fn load_config_reads_embedded_toml() {
        let config = load_config().expect("config should load");
        assert_eq!(config.app_name, "HappyHackingTools");
        assert!(config
            .preferred_extensions
            .iter()
            .any(|extension| extension == ".msi"));
        assert!(config.message.welcome.contains("セットアップ"));
    }

    #[test]
    fn build_release_api_url_uses_tag_endpoint() {
        let config = sample_config();
        let url = build_release_api_url(&config);
        assert_eq!(
            url,
            "https://api.github.com/repos/owner/repo/releases/tags/v1.2.3"
        );
    }

    #[test]
    fn build_release_api_url_uses_latest_endpoint() {
        let mut config = sample_config();
        config.release_tag = "latest".to_string();
        let url = build_release_api_url(&config);
        assert_eq!(
            url,
            "https://api.github.com/repos/owner/repo/releases/latest"
        );
    }

    #[test]
    fn build_release_page_url_uses_tag_page() {
        let config = sample_config();
        let url = build_release_page_url(&config);
        assert_eq!(url, "https://github.com/owner/repo/releases/tag/v1.2.3");
    }

    #[test]
    fn select_windows_installer_asset_prefers_msi_and_skips_bootstrapper() {
        let config = sample_config();
        let assets = vec![
            ReleaseAsset {
                name: "HappyHackingTools-bootstrapper.exe".to_string(),
                browser_download_url: "https://example.com/bootstrapper.exe".to_string(),
            },
            ReleaseAsset {
                name: "HappyHackingTools_0.1.0_x64-setup.exe".to_string(),
                browser_download_url: "https://example.com/setup.exe".to_string(),
            },
            ReleaseAsset {
                name: "HappyHackingTools_0.1.0_x64_en-US.msi".to_string(),
                browser_download_url: "https://example.com/setup.msi".to_string(),
            },
        ];

        let selected =
            select_windows_installer_asset(&assets, &config).expect("asset should exist");
        assert_eq!(selected.name, "HappyHackingTools_0.1.0_x64_en-US.msi");
    }

    #[test]
    fn resolve_installer_target_uses_temp_directory_and_asset_name() {
        let config = sample_config();
        let release = ReleaseMetadata {
            html_url: "https://github.com/owner/repo/releases/tag/v1.2.3".to_string(),
            assets: vec![ReleaseAsset {
                name: "HappyHackingTools_0.1.0_x64_en-US.msi".to_string(),
                browser_download_url: "https://example.com/setup.msi".to_string(),
            }],
        };

        let target = resolve_installer_target(&release, &config).expect("target should resolve");
        assert_eq!(target.asset_name, "HappyHackingTools_0.1.0_x64_en-US.msi");
        assert!(target.download_path.ends_with(
            Path::new("HappyHackingTools").join("HappyHackingTools_0.1.0_x64_en-US.msi")
        ));
    }

    #[test]
    fn resolve_installer_target_fails_when_only_bootstrapper_is_present() {
        let config = sample_config();
        let release = ReleaseMetadata {
            html_url: "https://github.com/owner/repo/releases/tag/v1.2.3".to_string(),
            assets: vec![ReleaseAsset {
                name: "HappyHackingTools-bootstrapper.exe".to_string(),
                browser_download_url: "https://example.com/bootstrapper.exe".to_string(),
            }],
        };

        let result = resolve_installer_target(&release, &config);
        assert!(matches!(result, Err(BootstrapperError::AssetNotFound)));
    }

    #[test]
    fn expand_windows_env_path_preserves_unknown_variable() {
        let value = expand_windows_env_path_with_lookup(
            "%LOCALAPPDATA%/Programs/%UNKNOWN%/HappyHackingTools.exe",
            |key| match key {
                "LOCALAPPDATA" => Some(r"C:\Users\Test\AppData\Local".to_string()),
                _ => None,
            },
        );

        assert_eq!(
            value,
            r"C:\Users\Test\AppData\Local/Programs/%UNKNOWN%/HappyHackingTools.exe"
        );
    }
}
