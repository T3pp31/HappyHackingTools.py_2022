use serde::Serialize;

use crate::error::AppError;

#[derive(Debug, Serialize, Clone)]
pub struct NetworkInfo {
    pub ip_address: String,
    pub broadcast_address: String,
    pub interface_name: String,
    pub subnet_mask: String,
    pub gateway: Option<String>,
}

#[tauri::command]
pub async fn get_network_info() -> Result<NetworkInfo, AppError> {
    crate::network::interface::get_active_network_info()
}
