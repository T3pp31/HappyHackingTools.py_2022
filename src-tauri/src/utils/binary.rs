use std::fs;
use std::io::{Read, Take};
use std::path::Path;

use sha2::{Digest, Sha256};

use crate::commands::binary::BinaryContent;
use crate::config::BinaryAnalysisConfig;
use crate::error::AppError;

const HEX_BYTES_PER_LINE: usize = 16;
const MAGIC_BYTES_LENGTH: usize = 16;

/// Read a file and return CTF-oriented binary analysis details.
pub fn read_file(
    file_path: &str,
    config: &BinaryAnalysisConfig,
) -> Result<BinaryContent, AppError> {
    let path = Path::new(file_path);

    if !path.exists() {
        return Err(AppError::File(format!("File not found: {}", file_path)));
    }

    let metadata =
        fs::metadata(path).map_err(|e| AppError::File(format!("Failed to get metadata: {}", e)))?;
    let file_size = metadata.len();
    let mut warnings = Vec::new();
    let read_limit = config.max_read_bytes.max(1) as u64;

    if file_size > read_limit {
        warnings.push(format!(
            "File is larger than configured max_read_bytes; analyzed first {} bytes of {} bytes.",
            read_limit, file_size
        ));
    }

    let file =
        fs::File::open(path).map_err(|e| AppError::File(format!("Failed to open file: {}", e)))?;
    let mut reader: Take<fs::File> = file.take(read_limit);
    let mut data = Vec::new();
    reader
        .read_to_end(&mut data)
        .map_err(|e| AppError::File(format!("Failed to read file: {}", e)))?;

    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let hex_dump = format_hex_dump(&data[..data.len().min(config.hex_preview_bytes)]);
    let decoded_slice = &data[..data.len().min(config.decoded_text_preview_bytes)];
    let decoded_text = String::from_utf8_lossy(decoded_slice).to_string();
    let magic_bytes = format_magic_bytes(&data);
    let file_type_guess = guess_file_type(&data);
    let sha256 = format_digest::<Sha256>(&data);
    let printable_strings = extract_printable_strings(
        &data,
        config.min_string_length.max(1),
        config.max_strings.max(1),
    );
    let flag_candidates = extract_flag_candidates(&printable_strings, &decoded_text);
    let entropy = calculate_entropy(&data);

    Ok(BinaryContent {
        hex_dump,
        decoded_text,
        file_size,
        file_name,
        magic_bytes,
        file_type_guess,
        sha256,
        printable_strings,
        flag_candidates,
        entropy,
        warnings,
    })
}

fn format_digest<D>(data: &[u8]) -> String
where
    D: Digest + Default,
{
    let mut hasher = D::default();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

fn format_magic_bytes(data: &[u8]) -> String {
    data.iter()
        .take(MAGIC_BYTES_LENGTH)
        .map(|byte| format!("{:02x}", byte))
        .collect::<Vec<_>>()
        .join(" ")
}

fn guess_file_type(data: &[u8]) -> String {
    let signatures: &[(&[u8], &str)] = &[
        (b"\x89PNG\r\n\x1a\n", "PNG image"),
        (b"\xff\xd8\xff", "JPEG image"),
        (b"GIF87a", "GIF image"),
        (b"GIF89a", "GIF image"),
        (b"PK\x03\x04", "ZIP archive"),
        (b"%PDF-", "PDF document"),
        (b"\x7fELF", "ELF binary"),
        (b"MZ", "Windows PE executable"),
        (b"SQLite format 3\0", "SQLite database"),
    ];

    signatures
        .iter()
        .find_map(|(signature, label)| data.starts_with(signature).then(|| (*label).to_string()))
        .unwrap_or_else(|| "Unknown".to_string())
}

fn extract_printable_strings(data: &[u8], min_length: usize, max_strings: usize) -> Vec<String> {
    let mut strings = Vec::new();
    let mut current = Vec::new();

    for byte in data {
        if byte.is_ascii_graphic() || *byte == b' ' {
            current.push(*byte);
        } else {
            push_string_candidate(&mut strings, &mut current, min_length, max_strings);
            if strings.len() >= max_strings {
                return strings;
            }
        }
    }

    push_string_candidate(&mut strings, &mut current, min_length, max_strings);
    strings
}

fn push_string_candidate(
    strings: &mut Vec<String>,
    current: &mut Vec<u8>,
    min_length: usize,
    max_strings: usize,
) {
    if current.len() >= min_length && strings.len() < max_strings {
        strings.push(String::from_utf8_lossy(current).to_string());
    }
    current.clear();
}

fn extract_flag_candidates(printable_strings: &[String], decoded_text: &str) -> Vec<String> {
    let mut candidates = Vec::new();
    for value in printable_strings
        .iter()
        .map(String::as_str)
        .chain(std::iter::once(decoded_text))
    {
        for token in value.split_whitespace() {
            let lower = token.to_ascii_lowercase();
            let looks_like_flag = ["flag{", "ctf{", "picoctf{", "htb{"]
                .iter()
                .any(|prefix| lower.contains(prefix))
                && token.contains('}');
            if looks_like_flag && !candidates.iter().any(|candidate| candidate == token) {
                candidates.push(
                    token
                        .trim_matches(|c: char| c.is_ascii_punctuation() && c != '{' && c != '}')
                        .to_string(),
                );
            }
        }
    }
    candidates
}

fn calculate_entropy(data: &[u8]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }

    let mut counts = [0usize; 256];
    for byte in data {
        counts[*byte as usize] += 1;
    }

    counts
        .iter()
        .filter(|count| **count > 0)
        .map(|count| {
            let probability = *count as f64 / data.len() as f64;
            -probability * probability.log2()
        })
        .sum()
}

fn format_hex_dump(data: &[u8]) -> String {
    let mut result = String::new();

    for (i, chunk) in data.chunks(HEX_BYTES_PER_LINE).enumerate() {
        result.push_str(&format!("{:08x}  ", i * HEX_BYTES_PER_LINE));

        for (j, byte) in chunk.iter().enumerate() {
            result.push_str(&format!("{:02x} ", byte));
            if j == 7 {
                result.push(' ');
            }
        }

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
