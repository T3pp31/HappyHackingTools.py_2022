use crate::error::AppError;
use crate::network::web_check::{
    AuthHeaderInput, InputCheckRequest, WebCheckOptions, WebCheckResult,
};
use crate::AppState;

#[tauri::command]
pub async fn web_check(
    target_url: String,
    mode: Option<String>,
    auth_headers: Option<Vec<AuthHeaderInput>>,
    extra_paths: Option<Vec<String>>,
    input_checks: Option<Vec<InputCheckRequest>>,
    state: tauri::State<'_, AppState>,
) -> Result<WebCheckResult, AppError> {
    let options = WebCheckOptions {
        mode,
        auth_headers: auth_headers.unwrap_or_default(),
        extra_paths: extra_paths.unwrap_or_default(),
        input_checks: input_checks.unwrap_or_default(),
    };

    crate::network::web_check::check_with_options(&target_url, &state.http_client, options).await
}
