use serde::Serialize;

use crate::config::NPCAP_DOWNLOAD_URL;
use crate::error::AppError;
use crate::AppState;

#[derive(Debug, Serialize, Clone)]
pub struct ArpSpoofStatus {
    pub is_running: bool,
    pub packets_captured: u64,
    pub pcap_path: Option<String>,
}

#[tauri::command]
pub async fn start_arp_spoof(
    target_ip: String,
    gateway_ip: String,
    packet_count: u32,
    state: tauri::State<'_, AppState>,
) -> Result<String, AppError> {
    if !crate::network::npcap::is_npcap_available() {
        return Err(AppError::NpcapNotFound(NPCAP_DOWNLOAD_URL.to_string()));
    }
    crate::network::arp_spoof::start(
        &target_ip,
        &gateway_ip,
        packet_count,
        &state,
    )
    .await
}

#[tauri::command]
pub async fn stop_arp_spoof(
    state: tauri::State<'_, AppState>,
) -> Result<ArpSpoofStatus, AppError> {
    crate::network::arp_spoof::stop(&state).await
}

#[tauri::command]
pub async fn get_arp_spoof_status(
    state: tauri::State<'_, AppState>,
) -> Result<ArpSpoofStatus, AppError> {
    crate::network::arp_spoof::status(&state).await
}
