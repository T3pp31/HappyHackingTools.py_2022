use serde::Serialize;

use crate::error::AppError;

#[derive(Debug, Serialize, Clone)]
pub struct BinaryContent {
    pub hex_dump: String,
    pub decoded_text: String,
    pub file_size: u64,
    pub file_name: String,
}

#[tauri::command]
pub async fn read_binary_file(file_path: String) -> Result<BinaryContent, AppError> {
    crate::utils::binary::read_file(&file_path)
}
