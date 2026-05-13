use std::fs;
use std::path::Path;

#[tauri::command]
pub fn write_ctf_writeup(file_path: String, markdown: String) -> Result<(), String> {
    fs::write(Path::new(&file_path), markdown)
        .map_err(|error| format!("Failed to write CTF writeup: {}", error))
}
