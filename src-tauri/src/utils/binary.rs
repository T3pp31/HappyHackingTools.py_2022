use std::fs;
use std::path::Path;

use crate::commands::binary::BinaryContent;
use crate::error::AppError;

const HEX_BYTES_PER_LINE: usize = 16;

/// Read a file and return its hex dump and decoded text.
pub fn read_file(file_path: &str) -> Result<BinaryContent, AppError> {
    let path = Path::new(file_path);

    if !path.exists() {
        return Err(AppError::File(format!("File not found: {}", file_path)));
    }

    let data =
        fs::read(path).map_err(|e| AppError::File(format!("Failed to read file: {}", e)))?;

    let metadata = fs::metadata(path)
        .map_err(|e| AppError::File(format!("Failed to get metadata: {}", e)))?;

    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let hex_dump = format_hex_dump(&data);
    let decoded_text = String::from_utf8_lossy(&data).to_string();

    Ok(BinaryContent {
        hex_dump,
        decoded_text,
        file_size: metadata.len(),
        file_name,
    })
}

fn format_hex_dump(data: &[u8]) -> String {
    let mut result = String::new();

    for (i, chunk) in data.chunks(HEX_BYTES_PER_LINE).enumerate() {
        // Offset
        result.push_str(&format!("{:08x}  ", i * HEX_BYTES_PER_LINE));

        // Hex bytes
        for (j, byte) in chunk.iter().enumerate() {
            result.push_str(&format!("{:02x} ", byte));
            if j == 7 {
                result.push(' ');
            }
        }

        // Padding if last line is short
        if chunk.len() < HEX_BYTES_PER_LINE {
            let missing = HEX_BYTES_PER_LINE - chunk.len();
            for j in 0..missing {
                result.push_str("   ");
                if chunk.len() + j == 7 {
                    result.push(' ');
                }
            }
        }

        result.push_str(" |");

        // ASCII representation
        for byte in chunk {
            if byte.is_ascii_graphic() || *byte == b' ' {
                result.push(*byte as char);
            } else {
                result.push('.');
            }
        }

        result.push_str("|\n");
    }

    result
}
