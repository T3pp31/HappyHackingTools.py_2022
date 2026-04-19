use serde::Deserialize;
use std::path::PathBuf;

/// Npcap ダウンロードページの URL
pub const NPCAP_DOWNLOAD_URL: &str = "https://npcap.com/#download";

#[derive(Debug, Deserialize, Clone)]
pub struct AppConfig {
    pub scan: ScanConfig,
    pub vendor: VendorConfig,
    pub network: NetworkConfig,
    pub feature_flags: FeatureFlagsConfig,
    pub paths: PathsConfig,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ScanConfig {
    pub arp_timeout_ms: u64,
    pub arp_retry_count: u32,
    pub port_scan_timeout_ms: u64,
    pub port_scan_concurrency: usize,
    pub sniff_timeout_sec: u64,
    pub poison_interval_sec: u64,
    pub reset_packet_count: u32,
    pub progress_report_interval: u32,
    pub lan_scan_arp_retry_count: u32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct VendorConfig {
    pub api_url: String,
    pub use_local_oui: bool,
    pub api_timeout_ms: u64,
    pub user_agent: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct NetworkConfig {
    pub udp_probe_target: String,
    pub enable_external_cli_fallback: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct FeatureFlagsConfig {
    pub prefer_rust_implementation: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct PathsConfig {
    pub pcap_output_dir: String,
    pub pcap_filename: String,
}

impl AppConfig {
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        let config_path = Self::config_path();
        let content = std::fs::read_to_string(&config_path)?;
        let config: AppConfig = toml::from_str(&content)?;
        Ok(config)
    }

    fn config_path() -> PathBuf {
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_default();

        let config_path = exe_dir.join("config").join("default.toml");
        if config_path.exists() {
            return config_path;
        }

        PathBuf::from("config").join("default.toml")
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            scan: ScanConfig {
                arp_timeout_ms: 100,
                arp_retry_count: 10,
                port_scan_timeout_ms: 1000,
                port_scan_concurrency: 200,
                sniff_timeout_sec: 300,
                poison_interval_sec: 2,
                reset_packet_count: 5,
                progress_report_interval: 100,
                lan_scan_arp_retry_count: 1,
            },
            vendor: VendorConfig {
                api_url: "http://macvendors.co/api/".to_string(),
                use_local_oui: true,
                api_timeout_ms: 3000,
                user_agent: "API Browser".to_string(),
            },
            network: NetworkConfig {
                udp_probe_target: "8.8.8.8:80".to_string(),
                enable_external_cli_fallback: false,
            },
            feature_flags: FeatureFlagsConfig {
                prefer_rust_implementation: true,
            },
            paths: PathsConfig {
                pcap_output_dir: "captured".to_string(),
                pcap_filename: "arper.pcap".to_string(),
            },
        }
    }
}
