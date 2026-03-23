use serde::Serialize;

use crate::config::NPCAP_DOWNLOAD_URL;

#[derive(Debug, Serialize)]
pub struct NpcapStatus {
    pub available: bool,
    pub download_url: String,
}

#[tauri::command]
pub async fn check_npcap() -> NpcapStatus {
    NpcapStatus {
        available: crate::network::npcap::is_npcap_available(),
        download_url: NPCAP_DOWNLOAD_URL.to_string(),
    }
}
