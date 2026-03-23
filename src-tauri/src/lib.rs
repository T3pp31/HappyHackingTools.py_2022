mod commands;
mod config;
mod error;
mod network;
mod utils;

use config::AppConfig;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AppState {
    pub config: AppConfig,
    pub http_client: reqwest::Client,
    pub arp_spoof_running: Arc<Mutex<bool>>,
}

pub fn run() {
    let config = AppConfig::load().unwrap_or_default();
    let http_client = reqwest::Client::new();
    let state = AppState {
        config,
        http_client,
        arp_spoof_running: Arc::new(Mutex::new(false)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::network_info::get_network_info,
            commands::lan_scan::lan_scan,
            commands::port_scan::port_scan,
            commands::arp_spoof::start_arp_spoof,
            commands::arp_spoof::stop_arp_spoof,
            commands::arp_spoof::get_arp_spoof_status,
            commands::binary::read_binary_file,
            commands::npcap::check_npcap,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
