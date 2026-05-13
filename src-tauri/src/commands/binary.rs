use serde::Serialize;
use tauri::State;

use crate::error::AppError;
use crate::AppState;

#[derive(Debug, Serialize, Clone)]
pub struct BinaryContent {
    pub hex_dump: String,
    pub decoded_text: String,
    pub file_size: u64,
    pub file_name: String,
    pub magic_bytes: String,
    pub file_type_guess: String,
    pub sha256: String,
    pub printable_strings: Vec<String>,
    pub flag_candidates: Vec<String>,
    pub entropy: f64,
    pub warnings: Vec<String>,
}

#[tauri::command]
pub async fn read_binary_file(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<BinaryContent, AppError> {
    crate::utils::binary::read_file(&file_path, &state.config.binary_analysis)
}
