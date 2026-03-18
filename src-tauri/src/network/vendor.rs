use std::time::Duration;

use crate::config::VendorConfig;
use crate::error::AppError;

/// Lookup MAC vendor name via HTTP API.
pub async fn lookup_vendor(
    mac: &str,
    config: &VendorConfig,
) -> Result<Option<String>, AppError> {
    if mac.is_empty() {
        return Ok(None);
    }

    let url = format!("{}{}", config.api_url, mac);
    let timeout = Duration::from_millis(config.api_timeout_ms);

    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| AppError::Network(format!("HTTP client error: {}", e)))?;

    let response = match client
        .get(&url)
        .header("User-Agent", "API Browser")
        .send()
        .await
    {
        Ok(resp) => resp,
        Err(_) => return Ok(None), // Timeout or network error: return None
    };

    let body: serde_json::Value = match response.json().await {
        Ok(json) => json,
        Err(_) => return Ok(None),
    };

    let company = body
        .get("result")
        .and_then(|r| r.get("company"))
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());

    Ok(company)
}
