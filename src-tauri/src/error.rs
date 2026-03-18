use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Network error: {0}")]
    Network(String),

    #[error("Scan error: {0}")]
    Scan(String),

    #[error("File error: {0}")]
    File(String),

    #[error("Config error: {0}")]
    Config(String),

    #[error("ARP spoof error: {0}")]
    ArpSpoof(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type CommandResult<T> = Result<T, AppError>;
