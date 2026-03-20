use serde::Serialize;
use tauri::Window;

use crate::error::AppError;
use crate::AppState;

#[derive(Debug, Serialize, Clone)]
pub struct DeviceInfo {
    pub ip: String,
    pub mac: Option<String>,
    pub hostname: Option<String>,
    pub vendor_name: Option<String>,
}

#[tauri::command]
pub async fn lan_scan(
    start: u8,
    end: u8,
    state: tauri::State<'_, AppState>,
    window: Window,
) -> Result<Vec<DeviceInfo>, AppError> {
    crate::network::lan_scan::scan(start, end, &state.config, &state.http_client, &window).await
}
