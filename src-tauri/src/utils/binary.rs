use std::fs::File;
use std::io::{Read, Take};
use std::path::Path;

use openssl::hash::{Hasher, MessageDigest};

use crate::commands::binary::BinaryContent;
use crate::config::BinaryConfig;
use crate::error::AppError;

const HEX_BYTES_PER_LINE: usize = 16;
const STREAM_BUFFER_SIZE: usize = 64 * 1024;

/// Read a file and return CTF-oriented binary analysis details.
pub fn read_file(file_path: &str, config: &BinaryConfig) -> Result<BinaryContent, AppError> {
    let path = Path::new(file_path);

    if !path.exists() {
        return Err(AppError::File(format!("File not found: {}", file_path)));
    }

    let metadata = std::fs::metadata(path)
        .map_err(|e| AppError::File(format!("Failed to get metadata: {}", e)))?;

    if !metadata.is_file() {
        return Err(AppError::File(format!("Not a regular file: {}", file_path)));
    }

    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let mut warnings = Vec::new();
    let loaded_data = read_prefix(path, config.max_read_bytes, &mut warnings)?;
    let hash_and_entropy = calculate_hashes_and_entropy(path)?;

    if metadata.len() as u128 > config.max_read_bytes as u128 {
        warnings.push(format!(
            "File display analysis is limited to the first {} bytes of {} bytes.",
            config.max_read_bytes,
            metadata.len()
        ));
    }

    let hex_dump_bytes = config.hex_dump_bytes.min(loaded_data.len());
    let hex_dump = format_hex_dump(&loaded_data[..hex_dump_bytes]);
    if loaded_data.len() > hex_dump_bytes {
        warnings.push(format!(
            "Hex dump is limited to the first {} bytes of the loaded data.",
            hex_dump_bytes
        ));
    }

    let decoded_text =
        format_decoded_text(&loaded_data, config.decoded_text_max_chars, &mut warnings);
    let magic_bytes = format_magic_bytes(&loaded_data, config.magic_bytes_len);
    let file_type_guess = guess_file_type(&loaded_data).to_string();
    let printable_strings = extract_printable_strings(
        &loaded_data,
        config.min_string_len,
        config.max_strings,
        &mut warnings,
    );
    let flag_candidates = extract_flag_candidates(
        &printable_strings,
        config.max_flag_candidates,
        &mut warnings,
    );

    Ok(BinaryContent {
        hex_dump,
        decoded_text,
        file_size: metadata.len(),
        file_name,
        magic_bytes,
        file_type_guess,
        sha256: hash_and_entropy.sha256,
        sha1: hash_and_entropy.sha1,
        md5: hash_and_entropy.md5,
        printable_strings,
        flag_candidates,
        entropy: hash_and_entropy.entropy,
        warnings,
    })
}

fn read_prefix(
    path: &Path,
    max_read_bytes: usize,
    warnings: &mut Vec<String>,
) -> Result<Vec<u8>, AppError> {
    if max_read_bytes == 0 {
        warnings.push(
            "Configured max_read_bytes is 0; display analysis has no file bytes.".to_string(),
        );
        return Ok(Vec::new());
    }

    let file =
        File::open(path).map_err(|e| AppError::File(format!("Failed to read file: {}", e)))?;
    let mut limited_reader: Take<File> = file.take(max_read_bytes as u64);
    let mut data = Vec::with_capacity(max_read_bytes.min(STREAM_BUFFER_SIZE));
    limited_reader
        .read_to_end(&mut data)
        .map_err(|e| AppError::File(format!("Failed to read file: {}", e)))?;
    Ok(data)
}

struct HashAndEntropy {
    sha256: String,
    sha1: String,
    md5: String,
    entropy: f64,
}

fn calculate_hashes_and_entropy(path: &Path) -> Result<HashAndEntropy, AppError> {
    let mut file =
        File::open(path).map_err(|e| AppError::File(format!("Failed to read file: {}", e)))?;
    let mut sha256 = Hasher::new(MessageDigest::sha256())
        .map_err(|e| AppError::File(format!("Failed to initialize SHA-256: {}", e)))?;
    let mut sha1 = Hasher::new(MessageDigest::sha1())
        .map_err(|e| AppError::File(format!("Failed to initialize SHA-1: {}", e)))?;
    let mut md5 = Hasher::new(MessageDigest::md5())
        .map_err(|e| AppError::File(format!("Failed to initialize MD5: {}", e)))?;
    let mut byte_counts = [0_u64; 256];
    let mut total_bytes = 0_u64;
    let mut buffer = [0_u8; STREAM_BUFFER_SIZE];

    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|e| AppError::File(format!("Failed to read file: {}", e)))?;
        if read == 0 {
            break;
        }

        let chunk = &buffer[..read];
        sha256
            .update(chunk)
            .map_err(|e| AppError::File(format!("Failed to update SHA-256: {}", e)))?;
        sha1.update(chunk)
            .map_err(|e| AppError::File(format!("Failed to update SHA-1: {}", e)))?;
        md5.update(chunk)
            .map_err(|e| AppError::File(format!("Failed to update MD5: {}", e)))?;
        total_bytes += read as u64;

        for byte in chunk {
            byte_counts[*byte as usize] += 1;
        }
    }

    let sha256 = sha256
        .finish()
        .map_err(|e| AppError::File(format!("Failed to finalize SHA-256: {}", e)))?;
    let sha1 = sha1
        .finish()
        .map_err(|e| AppError::File(format!("Failed to finalize SHA-1: {}", e)))?;
    let md5 = md5
        .finish()
        .map_err(|e| AppError::File(format!("Failed to finalize MD5: {}", e)))?;

    Ok(HashAndEntropy {
        sha256: to_hex(sha256.as_ref()),
        sha1: to_hex(sha1.as_ref()),
        md5: to_hex(md5.as_ref()),
        entropy: calculate_entropy(&byte_counts, total_bytes),
    })
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{:02x}", byte)).collect()
}

fn calculate_entropy(byte_counts: &[u64; 256], total_bytes: u64) -> f64 {
    if total_bytes == 0 {
        return 0.0;
    }

    let total = total_bytes as f64;
    byte_counts
        .iter()
        .filter(|count| **count > 0)
        .map(|count| {
            let probability = *count as f64 / total;
            -probability * probability.log2()
        })
        .sum()
}

fn format_magic_bytes(data: &[u8], magic_bytes_len: usize) -> String {
    data.iter()
        .take(magic_bytes_len)
        .map(|byte| format!("{:02x}", byte))
        .collect::<Vec<_>>()
        .join(" ")
}

fn guess_file_type(data: &[u8]) -> &'static str {
    if data.is_empty() {
        return "Empty file";
    }

    let signatures: &[(&[u8], &str)] = &[
        (b"\x7fELF", "ELF executable/shared object"),
        (b"MZ", "Windows PE/DOS executable"),
        (b"\x89PNG\r\n\x1a\n", "PNG image"),
        (b"\xff\xd8\xff", "JPEG image"),
        (b"GIF87a", "GIF image"),
        (b"GIF89a", "GIF image"),
        (b"%PDF-", "PDF document"),
        (b"PK\x03\x04", "ZIP archive or OOXML/JAR/APK"),
        (b"PK\x05\x06", "Empty ZIP archive"),
        (b"PK\x07\x08", "Spanned ZIP archive"),
        (b"\x1f\x8b", "Gzip compressed data"),
        (b"BZh", "Bzip2 compressed data"),
        (b"7z\xbc\xaf\x27\x1c", "7-Zip archive"),
        (b"Rar!\x1a\x07\x00", "RAR archive"),
        (b"\xca\xfe\xba\xbe", "Java class or Mach-O fat binary"),
        (b"\xfe\xed\xfa\xce", "Mach-O binary"),
        (b"\xfe\xed\xfa\xcf", "Mach-O 64-bit binary"),
        (b"\xcf\xfa\xed\xfe", "Mach-O 64-bit binary"),
        (b"\xce\xfa\xed\xfe", "Mach-O binary"),
        (b"SQLite format 3\x00", "SQLite database"),
    ];

    signatures
        .iter()
        .find_map(|(signature, description)| data.starts_with(signature).then_some(*description))
        .unwrap_or("Unknown binary/data")
}

fn extract_printable_strings(
    data: &[u8],
    min_string_len: usize,
    max_strings: usize,
    warnings: &mut Vec<String>,
) -> Vec<String> {
    if min_string_len == 0 || max_strings == 0 {
        if max_strings == 0 {
            warnings
                .push("Configured max_strings is 0; string extraction is disabled.".to_string());
        }
        return Vec::new();
    }

    let mut strings = Vec::new();
    let mut current = Vec::new();
    let mut truncated = false;

    for byte in data.iter().copied().chain(std::iter::once(0)) {
        if is_string_byte(byte) {
            current.push(byte);
            continue;
        }

        if current.len() >= min_string_len {
            if strings.len() < max_strings {
                strings.push(String::from_utf8_lossy(&current).to_string());
            } else {
                truncated = true;
                break;
            }
        }
        current.clear();
    }

    if truncated {
        warnings.push(format!(
            "Printable strings are limited to the first {} matches.",
            max_strings
        ));
    }

    strings
}

fn is_string_byte(byte: u8) -> bool {
    byte.is_ascii_graphic() || byte == b' ' || byte == b'\t'
}

fn extract_flag_candidates(
    printable_strings: &[String],
    max_flag_candidates: usize,
    warnings: &mut Vec<String>,
) -> Vec<String> {
    if max_flag_candidates == 0 {
        return Vec::new();
    }

    let mut candidates = Vec::new();
    let mut truncated = false;

    for printable in printable_strings {
        for token in printable.split_whitespace() {
            if looks_like_flag(token) && !candidates.iter().any(|candidate| candidate == token) {
                if candidates.len() < max_flag_candidates {
                    candidates.push(token.to_string());
                } else {
                    truncated = true;
                    break;
                }
            }
        }

        if truncated {
            break;
        }
    }

    if truncated {
        warnings.push(format!(
            "Flag candidates are limited to the first {} matches.",
            max_flag_candidates
        ));
    }

    candidates
}

fn looks_like_flag(token: &str) -> bool {
    let lower = token.to_ascii_lowercase();
    let known_prefix = lower.contains("flag{")
        || lower.contains("ctf{")
        || lower.contains("picoctf{")
        || lower.contains("htb{")
        || lower.contains("tryhackme{");

    known_prefix || (token.contains('{') && token.contains('}') && token.len() <= 128)
}

fn format_decoded_text(data: &[u8], max_chars: usize, warnings: &mut Vec<String>) -> String {
    if max_chars == 0 {
        warnings
            .push("Configured decoded_text_max_chars is 0; decoded text is hidden.".to_string());
        return String::new();
    }

    let decoded = String::from_utf8_lossy(data);
    let mut result = String::new();
    let mut chars = decoded.chars();

    for _ in 0..max_chars {
        match chars.next() {
            Some(ch) => result.push(ch),
            None => return result,
        }
    }

    if chars.next().is_some() {
        warnings.push(format!(
            "Decoded text is limited to the first {} characters.",
            max_chars
        ));
    }

    result
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn test_config() -> BinaryConfig {
        BinaryConfig {
            max_read_bytes: 128,
            hex_dump_bytes: 32,
            decoded_text_max_chars: 64,
            max_strings: 8,
            min_string_len: 4,
            magic_bytes_len: 8,
            max_flag_candidates: 4,
        }
    }

    #[test]
    fn read_file_returns_ctf_analysis_fields() {
        let path = std::env::temp_dir().join(format!(
            "happyhacking_binary_test_{}.bin",
            std::process::id()
        ));
        fs::write(
            &path,
            b"\x7fELF\x02\x01\x01\0padding flag{demo_flag} another-string",
        )
        .expect("write test binary");

        let content = read_file(path.to_str().expect("utf-8 temp path"), &test_config())
            .expect("read test binary");

        assert_eq!(content.file_type_guess, "ELF executable/shared object");
        assert_eq!(content.magic_bytes, "7f 45 4c 46 02 01 01 00");
        assert_eq!(content.sha256.len(), 64);
        assert_eq!(content.sha1.len(), 40);
        assert_eq!(content.md5.len(), 32);
        assert!(content.entropy > 0.0);
        assert!(content
            .printable_strings
            .iter()
            .any(|value| value.contains("flag{demo_flag}")));
        assert!(content
            .flag_candidates
            .iter()
            .any(|value| value == "flag{demo_flag}"));

        fs::remove_file(path).expect("remove test binary");
    }

    #[test]
    fn read_file_limits_loaded_display_data() {
        let path = std::env::temp_dir().join(format!(
            "happyhacking_binary_limit_test_{}.bin",
            std::process::id()
        ));
        fs::write(&path, b"abcdefghijklmnopqrstuvwxyz").expect("write test binary");

        let mut config = test_config();
        config.max_read_bytes = 8;
        config.hex_dump_bytes = 4;
        config.decoded_text_max_chars = 4;

        let content =
            read_file(path.to_str().expect("utf-8 temp path"), &config).expect("read test binary");

        assert_eq!(content.decoded_text, "abcd");
        assert!(content.hex_dump.contains("61 62 63 64"));
        assert!(!content.hex_dump.contains("65"));
        assert!(content
            .warnings
            .iter()
            .any(|warning| warning.contains("limited")));

        fs::remove_file(path).expect("remove test binary");
    }
}
