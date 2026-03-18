use serde::Serialize;
use tauri::Window;

use crate::error::AppError;
use crate::AppState;

#[derive(Debug, Serialize, Clone)]
pub struct PortScanResult {
    pub ip: String,
    pub open_ports: Vec<u16>,
    pub scanned_range: (u16, u16),
}

#[tauri::command]
pub async fn port_scan(
    ip: String,
    port_start: u16,
    port_end: u16,
    state: tauri::State<'_, AppState>,
    window: Window,
) -> Result<PortScanResult, AppError> {
    crate::network::port_scan::scan(&ip, port_start, port_end, &state.config, &window).await
}
