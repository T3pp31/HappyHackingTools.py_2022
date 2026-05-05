use std::time::Instant;

use reqwest::header::{
    HeaderMap, HeaderName, HeaderValue, ACCESS_CONTROL_ALLOW_CREDENTIALS,
    ACCESS_CONTROL_ALLOW_ORIGIN, ALLOW, CACHE_CONTROL, CONTENT_TYPE, REFERRER_POLICY, SERVER,
    SET_COOKIE, STRICT_TRANSPORT_SECURITY, VARY, X_CONTENT_TYPE_OPTIONS, X_FRAME_OPTIONS,
};
use reqwest::{Client, Method, StatusCode, Url};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

const CONTENT_SECURITY_POLICY: &str = "content-security-policy";
const PERMISSIONS_POLICY: &str = "permissions-policy";
const CROSS_ORIGIN_OPENER_POLICY: &str = "cross-origin-opener-policy";
const CROSS_ORIGIN_RESOURCE_POLICY: &str = "cross-origin-resource-policy";
const CROSS_ORIGIN_EMBEDDER_POLICY: &str = "cross-origin-embedder-policy";
const CANARY: &str = "HHT_CANARY_12345";
const INERT_REDIRECT_URL: &str = "https://example.invalid/HHT_CANARY_12345";
const MAX_EXTRA_PATHS: usize = 5;
const MAX_INPUT_CHECKS: usize = 5;
const MAX_BODY_BYTES: usize = 256 * 1024;

#[derive(Debug, Deserialize, Clone)]
pub struct AuthHeaderInput {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct InputCheckRequest {
    pub name: Option<String>,
    pub method: Option<String>,
    pub url: Option<String>,
    pub path: Option<String>,
    pub parameter: String,
}

#[derive(Debug, Clone)]
pub struct WebCheckOptions {
    pub mode: Option<String>,
    pub auth_headers: Vec<AuthHeaderInput>,
    pub extra_paths: Vec<String>,
    pub input_checks: Vec<InputCheckRequest>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WebCheckMode {
    Passive,
    ManualActive,
    Discovery,
}

#[derive(Debug, Serialize, Clone)]
pub struct WebCheckResult {
    pub target_url: String,
    pub final_url: String,
    pub status_code: Option<u16>,
    pub response_time_ms: u128,
    pub redirected: bool,
    pub uses_https: bool,
    pub tls_valid: Option<bool>,
    pub tls_error: Option<String>,
    pub content_type: Option<String>,
    pub server_header: Option<String>,
    pub security_headers: Vec<HeaderCheck>,
    pub cors_checks: Vec<CorsCheck>,
    pub cookie_checks: Vec<CookieCheck>,
    pub allowed_methods: Vec<String>,
    pub path_checks: Vec<PathCheckResult>,
    pub input_checks: Vec<InputCheckResult>,
    pub form_candidates: Vec<FormCandidate>,
    pub findings: Vec<WebFinding>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct HeaderCheck {
    pub name: String,
    pub present: bool,
    pub severity: String,
    pub message: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct CorsCheck {
    pub name: String,
    pub value: Option<String>,
    pub severity: String,
    pub message: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct CookieCheck {
    pub name: String,
    pub secure: bool,
    pub http_only: bool,
    pub same_site: bool,
    pub same_site_value: Option<String>,
    pub prefix_valid: Option<bool>,
    pub severity: String,
    pub message: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct PathCheckResult {
    pub path: String,
    pub url: String,
    pub status_code: Option<u16>,
    pub content_type: Option<String>,
    pub cache_control: Option<String>,
    pub severity: String,
    pub message: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct InputCheckResult {
    pub name: String,
    pub method: String,
    pub url: String,
    pub parameter: String,
    pub reflected: bool,
    pub status_code: Option<u16>,
    pub error_signature: Option<String>,
    pub external_redirect: bool,
    pub severity: String,
    pub message: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct FormCandidate {
    pub action: String,
    pub method: String,
    pub inputs: Vec<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct WebFinding {
    pub severity: String,
    pub message: String,
}

#[allow(dead_code)]
pub async fn check(target_url: &str, client: &Client) -> Result<WebCheckResult, AppError> {
    check_with_options(
        target_url,
        client,
        WebCheckOptions {
            mode: None,
            auth_headers: Vec::new(),
            extra_paths: Vec::new(),
            input_checks: Vec::new(),
        },
    )
    .await
}

pub async fn check_with_options(
    target_url: &str,
    client: &Client,
    options: WebCheckOptions,
) -> Result<WebCheckResult, AppError> {
    let parsed_url = validate_target_url(target_url)?;
    let mode = parse_mode(options.mode.as_deref())?;
    validate_request_limits(&options)?;
    let auth_headers = parse_auth_headers(&options.auth_headers)?;
    let extra_paths = resolve_extra_paths(&parsed_url, &options.extra_paths)?;
    let input_checks = resolve_input_checks(&parsed_url, &options.input_checks)?;

    let target_uses_https = parsed_url.scheme() == "https";
    let started_at = Instant::now();

    let response = match request_primary(client, parsed_url.clone(), &auth_headers).await {
        Ok(response) => response,
        Err(error) if target_uses_https && is_likely_tls_error(&error) => {
            return Ok(tls_error_result(
                target_url,
                &parsed_url,
                started_at.elapsed().as_millis(),
                error.to_string(),
            ));
        }
        Err(error) => {
            return Err(AppError::Network(format!(
                "Failed to request target URL: {}",
                error
            )));
        }
    };

    let elapsed_ms = started_at.elapsed().as_millis();
    let status = response.status();
    let final_url_ref = response.url().clone();
    let final_url = final_url_ref.to_string();
    let redirected = final_url != parsed_url.to_string();
    let final_same_origin = is_same_origin(&parsed_url, &final_url_ref);
    let uses_https = if final_same_origin {
        final_url_ref.scheme() == "https"
    } else {
        target_uses_https
    };
    let headers = response.headers().clone();
    drop(response);

    if !final_same_origin {
        return Ok(external_redirect_result(
            target_url,
            final_url,
            status,
            elapsed_ms,
            target_uses_https,
        ));
    }

    let allowed_methods = request_allowed_methods(client, parsed_url.clone(), &auth_headers)
        .await
        .unwrap_or_default();
    let security_headers = analyze_security_headers(&headers, uses_https);
    let cors_checks = analyze_cors_headers(&headers);
    let cookie_checks = analyze_cookies(&headers, uses_https);
    let content_type = header_to_string(&headers, CONTENT_TYPE.as_str());
    let server_header = header_to_string(&headers, SERVER.as_str());

    let mut path_checks = Vec::new();
    for (raw_path, url) in extra_paths {
        path_checks.push(check_extra_path(client, &parsed_url, raw_path, url, &auth_headers).await);
    }

    let mut form_candidates = Vec::new();
    if mode == WebCheckMode::Discovery {
        form_candidates =
            discover_forms(client, &parsed_url, &auth_headers, content_type.as_deref()).await?;
    }

    let mut active_results = Vec::new();
    if mode == WebCheckMode::ManualActive {
        for request in input_checks {
            active_results.push(run_input_check(client, &parsed_url, request, &auth_headers).await);
        }
    }

    let findings = build_findings(
        status,
        uses_https,
        redirected,
        &security_headers,
        &cors_checks,
        &cookie_checks,
        &allowed_methods,
        content_type.as_deref(),
        server_header.as_deref(),
        &path_checks,
        &active_results,
        &form_candidates,
    );

    Ok(WebCheckResult {
        target_url: target_url.to_string(),
        final_url,
        status_code: Some(status.as_u16()),
        response_time_ms: elapsed_ms,
        redirected,
        uses_https,
        tls_valid: uses_https.then_some(true),
        tls_error: None,
        content_type,
        server_header,
        security_headers,
        cors_checks,
        cookie_checks,
        allowed_methods,
        path_checks,
        input_checks: active_results,
        form_candidates,
        findings,
    })
}

async fn request_primary(
    client: &Client,
    url: Url,
    auth_headers: &HeaderMap,
) -> Result<reqwest::Response, reqwest::Error> {
    let head_response = send_with_headers(client, Method::HEAD, url.clone(), auth_headers).await?;

    if matches!(
        head_response.status(),
        StatusCode::METHOD_NOT_ALLOWED | StatusCode::NOT_IMPLEMENTED
    ) {
        send_with_headers(client, Method::GET, url, auth_headers).await
    } else {
        Ok(head_response)
    }
}

async fn send_with_headers(
    client: &Client,
    method: Method,
    url: Url,
    auth_headers: &HeaderMap,
) -> Result<reqwest::Response, reqwest::Error> {
    let mut request = client.request(method, url);
    for (name, value) in auth_headers.iter() {
        request = request.header(name, value);
    }
    request.send().await
}

async fn request_allowed_methods(
    client: &Client,
    url: Url,
    auth_headers: &HeaderMap,
) -> Result<Vec<String>, reqwest::Error> {
    let response = send_with_headers(client, Method::OPTIONS, url, auth_headers).await?;
    Ok(parse_allowed_methods(response.headers()))
}

pub fn validate_target_url(target_url: &str) -> Result<Url, AppError> {
    let url = Url::parse(target_url)
        .map_err(|error| AppError::Network(format!("Invalid URL: {}", error)))?;

    match url.scheme() {
        "http" | "https" => Ok(url),
        scheme => Err(AppError::Network(format!(
            "Unsupported URL scheme '{}'. Only http:// and https:// URLs are allowed",
            scheme
        ))),
    }
}

fn parse_mode(mode: Option<&str>) -> Result<WebCheckMode, AppError> {
    match mode.unwrap_or("passive") {
        "passive" => Ok(WebCheckMode::Passive),
        "manualActive" => Ok(WebCheckMode::ManualActive),
        "discovery" => Ok(WebCheckMode::Discovery),
        other => Err(AppError::Network(format!(
            "Unsupported web check mode '{}'",
            other
        ))),
    }
}

fn validate_request_limits(options: &WebCheckOptions) -> Result<(), AppError> {
    if options.extra_paths.len() > MAX_EXTRA_PATHS {
        return Err(AppError::Network(format!(
            "extra_paths is limited to {} entries",
            MAX_EXTRA_PATHS
        )));
    }
    if options.input_checks.len() > MAX_INPUT_CHECKS {
        return Err(AppError::Network(format!(
            "input_checks is limited to {} entries",
            MAX_INPUT_CHECKS
        )));
    }
    Ok(())
}

fn parse_auth_headers(headers: &[AuthHeaderInput]) -> Result<HeaderMap, AppError> {
    let mut header_map = HeaderMap::new();
    for header in headers {
        let name = HeaderName::from_bytes(header.name.trim().as_bytes())
            .map_err(|error| AppError::Network(format!("Invalid auth header name: {}", error)))?;
        let value = HeaderValue::from_str(&header.value)
            .map_err(|error| AppError::Network(format!("Invalid auth header value: {}", error)))?;
        header_map.insert(name, value);
    }
    Ok(header_map)
}

fn resolve_extra_paths(base: &Url, paths: &[String]) -> Result<Vec<(String, Url)>, AppError> {
    paths
        .iter()
        .map(|path| {
            let url = resolve_same_origin_url(base, path)?;
            Ok((path.clone(), url))
        })
        .collect()
}

fn resolve_input_checks(
    base: &Url,
    checks: &[InputCheckRequest],
) -> Result<Vec<ResolvedInputCheck>, AppError> {
    checks
        .iter()
        .map(|check| {
            let method = check
                .method
                .as_deref()
                .unwrap_or("GET")
                .to_ascii_uppercase();
            if method != "GET" && method != "POST" {
                return Err(AppError::Network(
                    "input_checks only supports GET and POST".to_string(),
                ));
            }
            let target = check
                .url
                .as_deref()
                .or(check.path.as_deref())
                .unwrap_or(base.as_str());
            let url = resolve_same_origin_url(base, target)?;
            if check.parameter.trim().is_empty() {
                return Err(AppError::Network(
                    "input_checks parameter must not be empty".to_string(),
                ));
            }

            Ok(ResolvedInputCheck {
                name: check
                    .name
                    .clone()
                    .unwrap_or_else(|| check.parameter.trim().to_string()),
                method,
                url,
                parameter: check.parameter.trim().to_string(),
            })
        })
        .collect()
}

fn resolve_same_origin_url(base: &Url, raw: &str) -> Result<Url, AppError> {
    if raw.trim().is_empty() {
        return Err(AppError::Network("URL/path must not be empty".to_string()));
    }

    let url = base
        .join(raw.trim())
        .map_err(|error| AppError::Network(format!("Invalid URL/path: {}", error)))?;
    if !is_same_origin(base, &url) {
        return Err(AppError::Network(
            "Only same-origin URLs/paths are allowed".to_string(),
        ));
    }
    Ok(url)
}

fn is_same_origin(left: &Url, right: &Url) -> bool {
    left.scheme() == right.scheme()
        && left.host_str() == right.host_str()
        && left.port_or_known_default() == right.port_or_known_default()
}

#[derive(Debug, Clone)]
struct ResolvedInputCheck {
    name: String,
    method: String,
    url: Url,
    parameter: String,
}

pub fn analyze_security_headers(headers: &HeaderMap, uses_https: bool) -> Vec<HeaderCheck> {
    let mut checks = Vec::new();

    checks.push(analyze_hsts(headers, uses_https));
    checks.push(analyze_csp(headers));
    checks.push(analyze_nosniff(headers));
    checks.push(analyze_frame_protection(headers));
    checks.push(analyze_referrer_policy(headers));
    checks.push(check_header(
        headers,
        PERMISSIONS_POLICY,
        true,
        "Permissions-Policy is present",
        "Permissions-Policy is missing",
        "",
    ));
    checks.push(check_header(
        headers,
        CROSS_ORIGIN_OPENER_POLICY,
        true,
        "Cross-Origin-Opener-Policy is present",
        "Cross-Origin-Opener-Policy is missing",
        "",
    ));
    checks.push(check_header(
        headers,
        CROSS_ORIGIN_RESOURCE_POLICY,
        true,
        "Cross-Origin-Resource-Policy is present",
        "Cross-Origin-Resource-Policy is missing",
        "",
    ));
    checks.push(check_header(
        headers,
        CROSS_ORIGIN_EMBEDDER_POLICY,
        true,
        "Cross-Origin-Embedder-Policy is present",
        "Cross-Origin-Embedder-Policy is missing",
        "",
    ));

    checks
}

fn analyze_hsts(headers: &HeaderMap, uses_https: bool) -> HeaderCheck {
    if !uses_https {
        return HeaderCheck {
            name: STRICT_TRANSPORT_SECURITY.as_str().to_string(),
            present: false,
            severity: "info".to_string(),
            message: "HSTS is only applicable to HTTPS responses".to_string(),
        };
    }

    let Some(value) = header_to_string(headers, STRICT_TRANSPORT_SECURITY.as_str()) else {
        return HeaderCheck {
            name: STRICT_TRANSPORT_SECURITY.as_str().to_string(),
            present: false,
            severity: "warning".to_string(),
            message: "HSTS is missing on an HTTPS response".to_string(),
        };
    };

    match parse_hsts_max_age(&value) {
        Some(max_age) if max_age >= 15_552_000 => HeaderCheck {
            name: STRICT_TRANSPORT_SECURITY.as_str().to_string(),
            present: true,
            severity: "ok".to_string(),
            message: "HSTS max-age is reasonable".to_string(),
        },
        Some(max_age) => HeaderCheck {
            name: STRICT_TRANSPORT_SECURITY.as_str().to_string(),
            present: true,
            severity: "warning".to_string(),
            message: format!("HSTS max-age is low ({})", max_age),
        },
        None => HeaderCheck {
            name: STRICT_TRANSPORT_SECURITY.as_str().to_string(),
            present: true,
            severity: "warning".to_string(),
            message: "HSTS max-age is missing or invalid".to_string(),
        },
    }
}

fn parse_hsts_max_age(value: &str) -> Option<u64> {
    value.split(';').find_map(|part| {
        let (name, value) = part.trim().split_once('=')?;
        if name.eq_ignore_ascii_case("max-age") {
            value.trim().parse().ok()
        } else {
            None
        }
    })
}

fn analyze_csp(headers: &HeaderMap) -> HeaderCheck {
    let Some(value) = header_to_string(headers, CONTENT_SECURITY_POLICY) else {
        return HeaderCheck {
            name: CONTENT_SECURITY_POLICY.to_string(),
            present: false,
            severity: "warning".to_string(),
            message: "Content-Security-Policy is missing".to_string(),
        };
    };

    let lower = value.to_ascii_lowercase();
    let mut issues = Vec::new();
    if lower.contains("'unsafe-inline'") {
        issues.push("unsafe-inline");
    }
    if lower.contains("'unsafe-eval'") {
        issues.push("unsafe-eval");
    }
    if lower.split(';').any(|directive| {
        directive
            .split_whitespace()
            .skip(1)
            .any(|token| token == "*")
    }) {
        issues.push("wildcard source");
    }
    if !lower.contains("frame-ancestors") {
        issues.push("missing frame-ancestors");
    }

    HeaderCheck {
        name: CONTENT_SECURITY_POLICY.to_string(),
        present: true,
        severity: if issues.is_empty() { "ok" } else { "warning" }.to_string(),
        message: if issues.is_empty() {
            "Content-Security-Policy is present".to_string()
        } else {
            format!("CSP has weak settings: {}", issues.join(", "))
        },
    }
}

fn analyze_nosniff(headers: &HeaderMap) -> HeaderCheck {
    match header_to_string(headers, X_CONTENT_TYPE_OPTIONS.as_str()) {
        Some(value) if value.eq_ignore_ascii_case("nosniff") => HeaderCheck {
            name: X_CONTENT_TYPE_OPTIONS.as_str().to_string(),
            present: true,
            severity: "ok".to_string(),
            message: "X-Content-Type-Options nosniff is present".to_string(),
        },
        Some(_) => HeaderCheck {
            name: X_CONTENT_TYPE_OPTIONS.as_str().to_string(),
            present: true,
            severity: "warning".to_string(),
            message: "X-Content-Type-Options is not nosniff".to_string(),
        },
        None => HeaderCheck {
            name: X_CONTENT_TYPE_OPTIONS.as_str().to_string(),
            present: false,
            severity: "warning".to_string(),
            message: "X-Content-Type-Options is missing".to_string(),
        },
    }
}

fn analyze_frame_protection(headers: &HeaderMap) -> HeaderCheck {
    let has_frame_ancestors = header_to_string(headers, CONTENT_SECURITY_POLICY)
        .map(|value| value.to_ascii_lowercase().contains("frame-ancestors"))
        .unwrap_or(false);
    let present = headers.contains_key(X_FRAME_OPTIONS) || has_frame_ancestors;

    HeaderCheck {
        name: X_FRAME_OPTIONS.as_str().to_string(),
        present,
        severity: if present { "ok" } else { "warning" }.to_string(),
        message: if present {
            "Frame embedding protection is present".to_string()
        } else {
            "Frame embedding protection is missing".to_string()
        },
    }
}

fn analyze_referrer_policy(headers: &HeaderMap) -> HeaderCheck {
    let Some(value) = header_to_string(headers, REFERRER_POLICY.as_str()) else {
        return HeaderCheck {
            name: REFERRER_POLICY.as_str().to_string(),
            present: false,
            severity: "warning".to_string(),
            message: "Referrer-Policy is missing".to_string(),
        };
    };
    let lower = value.to_ascii_lowercase();
    let strong = matches!(
        lower.as_str(),
        "no-referrer" | "same-origin" | "strict-origin" | "strict-origin-when-cross-origin"
    );

    HeaderCheck {
        name: REFERRER_POLICY.as_str().to_string(),
        present: true,
        severity: if strong { "ok" } else { "warning" }.to_string(),
        message: if strong {
            "Referrer-Policy is reasonable".to_string()
        } else {
            format!("Referrer-Policy is weak ({})", value)
        },
    }
}

fn check_header(
    headers: &HeaderMap,
    name: &str,
    applicable: bool,
    ok_message: &str,
    missing_message: &str,
    not_applicable_message: &str,
) -> HeaderCheck {
    if !applicable {
        return HeaderCheck {
            name: name.to_string(),
            present: false,
            severity: "info".to_string(),
            message: not_applicable_message.to_string(),
        };
    }

    let present = headers.contains_key(name);
    HeaderCheck {
        name: name.to_string(),
        present,
        severity: if present { "ok" } else { "warning" }.to_string(),
        message: if present { ok_message } else { missing_message }.to_string(),
    }
}

pub fn analyze_cors_headers(headers: &HeaderMap) -> Vec<CorsCheck> {
    let acao = header_to_string(headers, ACCESS_CONTROL_ALLOW_ORIGIN.as_str());
    let credentials = header_to_string(headers, ACCESS_CONTROL_ALLOW_CREDENTIALS.as_str());
    let credentials_true = credentials
        .as_deref()
        .map(|value| value.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let vary = header_to_string(headers, VARY.as_str());
    let mut checks = Vec::new();

    checks.push(match acao.as_deref() {
        None => CorsCheck {
            name: ACCESS_CONTROL_ALLOW_ORIGIN.as_str().to_string(),
            value: None,
            severity: "info".to_string(),
            message: "CORS allow-origin is not set".to_string(),
        },
        Some("*") if credentials_true => CorsCheck {
            name: ACCESS_CONTROL_ALLOW_ORIGIN.as_str().to_string(),
            value: acao.clone(),
            severity: "warning".to_string(),
            message: "CORS allows any origin while credentials are enabled".to_string(),
        },
        Some("*") => CorsCheck {
            name: ACCESS_CONTROL_ALLOW_ORIGIN.as_str().to_string(),
            value: acao.clone(),
            severity: "warning".to_string(),
            message: "CORS allows any origin".to_string(),
        },
        Some("null") => CorsCheck {
            name: ACCESS_CONTROL_ALLOW_ORIGIN.as_str().to_string(),
            value: acao.clone(),
            severity: "warning".to_string(),
            message: "CORS allows the null origin".to_string(),
        },
        Some(_) => CorsCheck {
            name: ACCESS_CONTROL_ALLOW_ORIGIN.as_str().to_string(),
            value: acao.clone(),
            severity: "ok".to_string(),
            message: "CORS allow-origin is explicit".to_string(),
        },
    });

    checks.push(CorsCheck {
        name: ACCESS_CONTROL_ALLOW_CREDENTIALS.as_str().to_string(),
        value: credentials.clone(),
        severity: if credentials_true { "info" } else { "ok" }.to_string(),
        message: if credentials_true {
            "CORS credentials are enabled".to_string()
        } else {
            "CORS credentials are not enabled".to_string()
        },
    });

    if matches!(acao.as_deref(), Some(value) if value != "*" && value != "null")
        && vary
            .as_deref()
            .map(|value| value.to_ascii_lowercase().contains("origin"))
            .unwrap_or(false)
            == false
    {
        checks.push(CorsCheck {
            name: VARY.as_str().to_string(),
            value: vary,
            severity: "warning".to_string(),
            message: "CORS response should vary on Origin".to_string(),
        });
    }

    checks
}

pub fn analyze_cookies(headers: &HeaderMap, uses_https: bool) -> Vec<CookieCheck> {
    headers
        .get_all(SET_COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .map(|cookie| analyze_cookie(cookie, uses_https))
        .collect()
}

pub fn analyze_cookie(cookie: &str, uses_https: bool) -> CookieCheck {
    let mut parts = cookie.split(';').map(str::trim);
    let name = parts
        .next()
        .and_then(|part| part.split_once('=').map(|(name, _)| name))
        .filter(|name| !name.is_empty())
        .unwrap_or("unnamed")
        .to_string();

    let attributes: Vec<String> = parts.map(|part| part.to_string()).collect();
    let lower_attributes: Vec<String> = attributes
        .iter()
        .map(|attribute| attribute.to_ascii_lowercase())
        .collect();
    let secure = lower_attributes
        .iter()
        .any(|attribute| attribute == "secure");
    let http_only = lower_attributes
        .iter()
        .any(|attribute| attribute == "httponly");
    let same_site_value = attributes.iter().find_map(|attribute| {
        let (key, value) = attribute.split_once('=')?;
        if key.trim().eq_ignore_ascii_case("samesite") {
            Some(value.trim().to_string())
        } else {
            None
        }
    });
    let same_site = same_site_value.is_some();
    let path = attributes.iter().find_map(|attribute| {
        let (key, value) = attribute.split_once('=')?;
        if key.trim().eq_ignore_ascii_case("path") {
            Some(value.trim().to_string())
        } else {
            None
        }
    });
    let has_domain = lower_attributes
        .iter()
        .any(|attribute| attribute.starts_with("domain="));

    let prefix_valid = if name.starts_with("__Host-") {
        Some(secure && path.as_deref() == Some("/") && !has_domain)
    } else if name.starts_with("__Secure-") {
        Some(secure)
    } else {
        None
    };

    let mut missing = Vec::new();
    if uses_https && !secure {
        missing.push("Secure");
    }
    if !http_only {
        missing.push("HttpOnly");
    }
    if !same_site {
        missing.push("SameSite");
    }
    if same_site_value
        .as_deref()
        .map(|value| value.eq_ignore_ascii_case("none"))
        .unwrap_or(false)
        && !secure
    {
        missing.push("Secure for SameSite=None");
    }
    if prefix_valid == Some(false) {
        if name.starts_with("__Host-") {
            missing.push("__Host- prefix rules");
        } else {
            missing.push("__Secure- prefix rules");
        }
    }

    CookieCheck {
        name,
        secure,
        http_only,
        same_site,
        same_site_value,
        prefix_valid,
        severity: if missing.is_empty() { "ok" } else { "warning" }.to_string(),
        message: if missing.is_empty() {
            "Cookie has expected security attributes".to_string()
        } else {
            format!("Cookie is missing or violates {}", missing.join(", "))
        },
    }
}

pub fn parse_allowed_methods(headers: &HeaderMap) -> Vec<String> {
    let mut methods: Vec<String> = headers
        .get(ALLOW)
        .and_then(|value| value.to_str().ok())
        .map(|value| {
            value
                .split(',')
                .map(str::trim)
                .filter(|method| !method.is_empty())
                .map(|method| method.to_ascii_uppercase())
                .collect()
        })
        .unwrap_or_default();

    methods.sort();
    methods.dedup();
    methods
}

pub fn dangerous_allowed_methods(methods: &[String]) -> Vec<String> {
    methods
        .iter()
        .filter(|method| matches!(method.as_str(), "TRACE" | "PUT" | "DELETE" | "PATCH"))
        .cloned()
        .collect()
}

async fn check_extra_path(
    client: &Client,
    base: &Url,
    raw_path: String,
    url: Url,
    auth_headers: &HeaderMap,
) -> PathCheckResult {
    match request_primary(client, url.clone(), auth_headers).await {
        Ok(response) => {
            let external_redirect = !is_same_origin(base, response.url());
            let status = response.status();
            let headers = response.headers().clone();
            let (severity, message) = if external_redirect {
                (
                    "warning",
                    "Path redirected to a different origin and was not diagnosed".to_string(),
                )
            } else if status.is_server_error() {
                ("warning", format!("Path returned {}", status.as_u16()))
            } else if status.is_client_error() {
                ("info", format!("Path returned {}", status.as_u16()))
            } else {
                ("ok", format!("Path returned {}", status.as_u16()))
            };

            PathCheckResult {
                path: raw_path,
                url: url.to_string(),
                status_code: Some(status.as_u16()),
                content_type: if external_redirect {
                    None
                } else {
                    header_to_string(&headers, CONTENT_TYPE.as_str())
                },
                cache_control: if external_redirect {
                    None
                } else {
                    header_to_string(&headers, CACHE_CONTROL.as_str())
                },
                severity: severity.to_string(),
                message,
            }
        }
        Err(error) => PathCheckResult {
            path: raw_path,
            url: url.to_string(),
            status_code: None,
            content_type: None,
            cache_control: None,
            severity: "warning".to_string(),
            message: format!("Path request failed: {}", error),
        },
    }
}

async fn discover_forms(
    client: &Client,
    target_url: &Url,
    auth_headers: &HeaderMap,
    primary_content_type: Option<&str>,
) -> Result<Vec<FormCandidate>, AppError> {
    if !is_html_content_type(primary_content_type) && primary_content_type.is_some() {
        return Ok(Vec::new());
    }

    let response = send_with_headers(client, Method::GET, target_url.clone(), auth_headers)
        .await
        .map_err(|error| AppError::Network(format!("Failed to request HTML: {}", error)))?;
    if !is_same_origin(target_url, response.url()) {
        return Ok(Vec::new());
    }
    if !is_html_content_type(header_to_string(response.headers(), CONTENT_TYPE.as_str()).as_deref())
    {
        return Ok(Vec::new());
    }
    let body = response_body_limited(response).await?;
    Ok(extract_form_candidates(&body, target_url))
}

pub fn extract_form_candidates(html: &str, target_url: &Url) -> Vec<FormCandidate> {
    let lower = html.to_ascii_lowercase();
    let mut candidates = Vec::new();
    let mut offset = 0;

    while let Some(relative_start) = lower[offset..].find("<form") {
        let start = offset + relative_start;
        let Some(tag_end_relative) = lower[start..].find('>') else {
            break;
        };
        let tag_end = start + tag_end_relative;
        let form_tag = &html[start..=tag_end];
        let method = extract_attr(form_tag, "method")
            .unwrap_or_else(|| "GET".to_string())
            .to_ascii_uppercase();
        let action = extract_attr(form_tag, "action").unwrap_or_else(|| target_url.to_string());

        let body_start = tag_end + 1;
        let end = lower[body_start..]
            .find("</form")
            .map(|relative_end| body_start + relative_end)
            .unwrap_or(html.len());
        let form_body = &html[body_start..end];
        let mut inputs = extract_named_controls(form_body);
        inputs.sort();
        inputs.dedup();
        candidates.push(FormCandidate {
            action,
            method,
            inputs,
        });

        offset = end.saturating_add(7);
        if candidates.len() >= 20 {
            break;
        }
    }

    candidates
}

fn extract_named_controls(html: &str) -> Vec<String> {
    ["input", "textarea", "select"]
        .iter()
        .flat_map(|tag| extract_tag_names(html, tag))
        .collect()
}

fn extract_tag_names(html: &str, tag_name: &str) -> Vec<String> {
    let lower = html.to_ascii_lowercase();
    let needle = format!("<{}", tag_name);
    let mut names = Vec::new();
    let mut offset = 0;

    while let Some(relative_start) = lower[offset..].find(&needle) {
        let start = offset + relative_start;
        let Some(tag_end_relative) = lower[start..].find('>') else {
            break;
        };
        let tag_end = start + tag_end_relative;
        if let Some(name) = extract_attr(&html[start..=tag_end], "name") {
            if !name.is_empty() {
                names.push(name);
            }
        }
        offset = tag_end + 1;
    }

    names
}

fn extract_attr(tag: &str, attr_name: &str) -> Option<String> {
    let bytes = tag.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        while index < bytes.len() && bytes[index].is_ascii_whitespace() {
            index += 1;
        }
        let name_start = index;
        while index < bytes.len()
            && (bytes[index].is_ascii_alphanumeric() || matches!(bytes[index], b'-' | b'_'))
        {
            index += 1;
        }
        if name_start == index {
            index += 1;
            continue;
        }
        let name = &tag[name_start..index];
        while index < bytes.len() && bytes[index].is_ascii_whitespace() {
            index += 1;
        }
        if index >= bytes.len() || bytes[index] != b'=' {
            continue;
        }
        index += 1;
        while index < bytes.len() && bytes[index].is_ascii_whitespace() {
            index += 1;
        }
        if index >= bytes.len() {
            break;
        }
        let value = if bytes[index] == b'"' || bytes[index] == b'\'' {
            let quote = bytes[index];
            index += 1;
            let value_start = index;
            while index < bytes.len() && bytes[index] != quote {
                index += 1;
            }
            let value = tag[value_start..index].to_string();
            index += 1;
            value
        } else {
            let value_start = index;
            while index < bytes.len()
                && !bytes[index].is_ascii_whitespace()
                && !matches!(bytes[index], b'>')
            {
                index += 1;
            }
            tag[value_start..index].to_string()
        };

        if name.eq_ignore_ascii_case(attr_name) {
            return Some(value);
        }
    }

    None
}

async fn run_input_check(
    client: &Client,
    base: &Url,
    request: ResolvedInputCheck,
    auth_headers: &HeaderMap,
) -> InputCheckResult {
    let value = active_value_for_parameter(&request.parameter);
    let mut request_url = request.url.clone();
    let response_result = if request.method == "GET" {
        request_url
            .query_pairs_mut()
            .append_pair(&request.parameter, value);
        send_with_headers(client, Method::GET, request_url.clone(), auth_headers).await
    } else {
        let body = format!(
            "{}={}",
            percent_encode(&request.parameter),
            percent_encode(value)
        );
        let mut builder = client
            .request(Method::POST, request_url.clone())
            .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
            .body(body);
        for (name, value) in auth_headers.iter() {
            builder = builder.header(name, value);
        }
        builder.send().await
    };

    match response_result {
        Ok(response) => {
            let status = response.status();
            let external_redirect = !is_same_origin(base, response.url());
            let final_url = response.url().to_string();
            let body = if external_redirect {
                String::new()
            } else {
                response_body_limited(response).await.unwrap_or_default()
            };
            build_input_check_result(
                request.name,
                request.method,
                final_url,
                request.parameter,
                Some(status.as_u16()),
                &body,
                external_redirect,
                value,
            )
        }
        Err(error) => {
            let external_redirect = error
                .url()
                .map(|url| !is_same_origin(base, url))
                .unwrap_or(false);
            InputCheckResult {
                name: request.name,
                method: request.method,
                url: request_url.to_string(),
                parameter: request.parameter,
                reflected: false,
                status_code: None,
                error_signature: Some(error.to_string()),
                external_redirect,
                severity: "warning".to_string(),
                message: if external_redirect {
                    "Input check redirected to a different origin and then failed".to_string()
                } else {
                    "Input check request failed".to_string()
                },
            }
        }
    }
}

fn active_value_for_parameter(parameter: &str) -> &'static str {
    let lower = parameter.to_ascii_lowercase();
    if lower.contains("redirect")
        || lower == "url"
        || lower.contains("next")
        || lower.contains("return")
        || lower.contains("continue")
    {
        INERT_REDIRECT_URL
    } else {
        CANARY
    }
}

pub fn build_input_check_result(
    name: String,
    method: String,
    url: String,
    parameter: String,
    status_code: Option<u16>,
    body: &str,
    external_redirect: bool,
    sent_value: &str,
) -> InputCheckResult {
    let reflected = body.contains(sent_value) || body.contains(CANARY);
    let error_signature = detect_error_signature(status_code, body);
    let severity = if external_redirect || error_signature.is_some() || reflected {
        "warning"
    } else {
        "ok"
    };
    let mut messages = Vec::new();
    if reflected {
        messages.push("canary was reflected");
    }
    if error_signature.is_some() {
        messages.push("error signature was observed");
    }
    if external_redirect {
        messages.push("redirect target changed to a different origin");
    }

    InputCheckResult {
        name,
        method,
        url,
        parameter,
        reflected,
        status_code,
        error_signature,
        external_redirect,
        severity: severity.to_string(),
        message: if messages.is_empty() {
            "No active signal observed".to_string()
        } else {
            messages.join(", ")
        },
    }
}

fn detect_error_signature(status_code: Option<u16>, body: &str) -> Option<String> {
    if status_code.map(|status| status >= 500).unwrap_or(false) {
        return Some("server_error_status".to_string());
    }
    let lower = body.to_ascii_lowercase();
    let signatures = [
        "sql syntax",
        "mysql",
        "postgresql",
        "ora-",
        "stack trace",
        "traceback",
        "exception",
        "warning:",
        "fatal error",
    ];
    signatures
        .iter()
        .find(|signature| lower.contains(**signature))
        .map(|signature| signature.to_string())
}

fn percent_encode(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                vec![byte as char]
            }
            b' ' => vec!['+'],
            _ => format!("%{:02X}", byte).chars().collect(),
        })
        .collect()
}

async fn response_body_limited(response: reqwest::Response) -> Result<String, AppError> {
    let bytes = response
        .bytes()
        .await
        .map_err(|error| AppError::Network(format!("Failed to read response body: {}", error)))?;
    let limited = if bytes.len() > MAX_BODY_BYTES {
        &bytes[..MAX_BODY_BYTES]
    } else {
        &bytes
    };
    Ok(String::from_utf8_lossy(limited).to_string())
}

fn is_html_content_type(content_type: Option<&str>) -> bool {
    content_type
        .map(|value| value.to_ascii_lowercase().contains("text/html"))
        .unwrap_or(true)
}

pub fn build_findings(
    status: StatusCode,
    uses_https: bool,
    redirected: bool,
    security_headers: &[HeaderCheck],
    cors_checks: &[CorsCheck],
    cookie_checks: &[CookieCheck],
    allowed_methods: &[String],
    content_type: Option<&str>,
    server_header: Option<&str>,
    path_checks: &[PathCheckResult],
    input_checks: &[InputCheckResult],
    form_candidates: &[FormCandidate],
) -> Vec<WebFinding> {
    let mut findings = Vec::new();

    if !uses_https {
        findings.push(WebFinding {
            severity: "warning".to_string(),
            message: "Target URL does not use HTTPS".to_string(),
        });
    }

    if status.is_server_error() {
        findings.push(WebFinding {
            severity: "warning".to_string(),
            message: format!("Server returned {}", status.as_u16()),
        });
    } else if status.is_client_error() {
        findings.push(WebFinding {
            severity: "info".to_string(),
            message: format!("Target returned {}", status.as_u16()),
        });
    }

    if redirected {
        findings.push(WebFinding {
            severity: "info".to_string(),
            message: "Target redirected to a different final URL".to_string(),
        });
    }

    findings.extend(
        security_headers
            .iter()
            .filter(|check| check.severity == "warning")
            .map(|check| WebFinding {
                severity: check.severity.clone(),
                message: check.message.clone(),
            }),
    );
    findings.extend(
        cors_checks
            .iter()
            .filter(|check| check.severity == "warning")
            .map(|check| WebFinding {
                severity: check.severity.clone(),
                message: check.message.clone(),
            }),
    );
    findings.extend(
        cookie_checks
            .iter()
            .filter(|check| check.severity == "warning")
            .map(|check| WebFinding {
                severity: check.severity.clone(),
                message: check.message.clone(),
            }),
    );

    let dangerous_methods = dangerous_allowed_methods(allowed_methods);
    if !dangerous_methods.is_empty() {
        findings.push(WebFinding {
            severity: "warning".to_string(),
            message: format!(
                "Allowed methods include potentially risky methods: {}",
                dangerous_methods.join(", ")
            ),
        });
    }

    if let Some(server) = server_header {
        if !server.trim().is_empty() {
            findings.push(WebFinding {
                severity: "info".to_string(),
                message: "Server header is exposed".to_string(),
            });
        }
    }

    if content_type
        .map(|value| value.to_ascii_lowercase().contains("text/html"))
        .unwrap_or(false)
        && !has_nosniff(security_headers)
    {
        findings.push(WebFinding {
            severity: "warning".to_string(),
            message: "HTML response is missing X-Content-Type-Options nosniff".to_string(),
        });
    }

    findings.extend(
        path_checks
            .iter()
            .filter(|check| check.severity == "warning")
            .map(|check| WebFinding {
                severity: check.severity.clone(),
                message: format!("Path check {}: {}", check.path, check.message),
            }),
    );
    if !path_checks.is_empty() {
        findings.push(WebFinding {
            severity: "info".to_string(),
            message: format!("Checked {} extra path(s)", path_checks.len()),
        });
    }
    findings.extend(
        input_checks
            .iter()
            .filter(|check| check.severity == "warning")
            .map(|check| WebFinding {
                severity: check.severity.clone(),
                message: format!("Input check {}: {}", check.name, check.message),
            }),
    );
    if !input_checks.is_empty() {
        findings.push(WebFinding {
            severity: "info".to_string(),
            message: format!("Ran {} manual input check(s)", input_checks.len()),
        });
    }

    if !form_candidates.is_empty() {
        findings.push(WebFinding {
            severity: "info".to_string(),
            message: format!("Discovered {} form candidate(s)", form_candidates.len()),
        });
    }

    if findings.is_empty() {
        findings.push(WebFinding {
            severity: "ok".to_string(),
            message: "No high-level issues found in lightweight checks".to_string(),
        });
    }

    findings
}

fn has_nosniff(security_headers: &[HeaderCheck]) -> bool {
    security_headers.iter().any(|check| {
        check.name == X_CONTENT_TYPE_OPTIONS.as_str() && check.present && check.severity == "ok"
    })
}

fn tls_error_result(
    target_url: &str,
    parsed_url: &Url,
    response_time_ms: u128,
    tls_error: String,
) -> WebCheckResult {
    WebCheckResult {
        target_url: target_url.to_string(),
        final_url: parsed_url.to_string(),
        status_code: None,
        response_time_ms,
        redirected: false,
        uses_https: parsed_url.scheme() == "https",
        tls_valid: Some(false),
        tls_error: Some(tls_error),
        content_type: None,
        server_header: None,
        security_headers: Vec::new(),
        cors_checks: Vec::new(),
        cookie_checks: Vec::new(),
        allowed_methods: Vec::new(),
        path_checks: Vec::new(),
        input_checks: Vec::new(),
        form_candidates: Vec::new(),
        findings: vec![WebFinding {
            severity: "high".to_string(),
            message: "TLS certificate validation failed".to_string(),
        }],
    }
}

fn external_redirect_result(
    target_url: &str,
    final_url: String,
    status: StatusCode,
    response_time_ms: u128,
    uses_https: bool,
) -> WebCheckResult {
    WebCheckResult {
        target_url: target_url.to_string(),
        final_url,
        status_code: Some(status.as_u16()),
        response_time_ms,
        redirected: true,
        uses_https,
        tls_valid: uses_https.then_some(true),
        tls_error: None,
        content_type: None,
        server_header: None,
        security_headers: Vec::new(),
        cors_checks: Vec::new(),
        cookie_checks: Vec::new(),
        allowed_methods: Vec::new(),
        path_checks: Vec::new(),
        input_checks: Vec::new(),
        form_candidates: Vec::new(),
        findings: vec![WebFinding {
            severity: "warning".to_string(),
            message: "Target redirected to a different origin; external response was not diagnosed"
                .to_string(),
        }],
    }
}

fn header_to_string(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(ToString::to_string)
}

fn is_likely_tls_error(error: &reqwest::Error) -> bool {
    let message = error.to_string().to_ascii_lowercase();
    message.contains("certificate") || message.contains("tls") || message.contains("ssl")
}

#[cfg(test)]
mod tests {
    use super::*;
    use reqwest::header::HeaderValue;

    #[test]
    fn web_check_rejects_unsupported_url_scheme() {
        let error = validate_target_url("ftp://example.com").unwrap_err();
        assert!(error.to_string().contains("Only http:// and https://"));
    }

    #[test]
    fn web_check_accepts_http_and_https_urls() {
        assert!(validate_target_url("http://example.com").is_ok());
        assert!(validate_target_url("https://example.com").is_ok());
    }

    #[test]
    fn web_check_enforces_same_origin_paths() {
        let base = Url::parse("https://example.com/app/index.html").unwrap();

        assert!(resolve_same_origin_url(&base, "/admin").is_ok());
        assert!(resolve_same_origin_url(&base, "settings").is_ok());
        assert!(resolve_same_origin_url(&base, "https://example.com/login").is_ok());
        assert!(resolve_same_origin_url(&base, "https://evil.example/login").is_err());
        assert!(resolve_same_origin_url(&base, "//evil.example/login").is_err());
    }

    #[test]
    fn web_check_enforces_max_counts() {
        let too_many_paths = WebCheckOptions {
            mode: None,
            auth_headers: Vec::new(),
            extra_paths: vec!["/x".to_string(); 6],
            input_checks: Vec::new(),
        };
        assert!(validate_request_limits(&too_many_paths).is_err());

        let too_many_inputs = WebCheckOptions {
            mode: None,
            auth_headers: Vec::new(),
            extra_paths: Vec::new(),
            input_checks: vec![
                InputCheckRequest {
                    name: None,
                    method: Some("GET".to_string()),
                    url: None,
                    path: None,
                    parameter: "q".to_string(),
                };
                6
            ],
        };
        assert!(validate_request_limits(&too_many_inputs).is_err());
    }

    #[test]
    fn web_check_reports_missing_security_headers() {
        let headers = HeaderMap::new();
        let checks = analyze_security_headers(&headers, true);

        assert!(checks.iter().any(|check| {
            check.name == STRICT_TRANSPORT_SECURITY.as_str() && check.severity == "warning"
        }));
        assert!(checks
            .iter()
            .any(|check| { check.name == CONTENT_SECURITY_POLICY && check.severity == "warning" }));
    }

    #[test]
    fn web_check_marks_hsts_inapplicable_for_http() {
        let headers = HeaderMap::new();
        let checks = analyze_security_headers(&headers, false);

        let hsts = checks
            .iter()
            .find(|check| check.name == STRICT_TRANSPORT_SECURITY.as_str())
            .unwrap();
        assert_eq!(hsts.severity, "info");
    }

    #[test]
    fn web_check_warns_for_low_hsts_and_weak_csp() {
        let mut headers = HeaderMap::new();
        headers.insert(
            STRICT_TRANSPORT_SECURITY,
            HeaderValue::from_static("max-age=60"),
        );
        headers.insert(
            HeaderName::from_static(CONTENT_SECURITY_POLICY),
            HeaderValue::from_static("default-src *; script-src 'unsafe-inline' 'unsafe-eval'"),
        );

        let checks = analyze_security_headers(&headers, true);
        let hsts = checks
            .iter()
            .find(|check| check.name == STRICT_TRANSPORT_SECURITY.as_str())
            .unwrap();
        let csp = checks
            .iter()
            .find(|check| check.name == CONTENT_SECURITY_POLICY)
            .unwrap();

        assert_eq!(hsts.severity, "warning");
        assert!(hsts.message.contains("low"));
        assert_eq!(csp.severity, "warning");
        assert!(csp.message.contains("unsafe-inline"));
        assert!(csp.message.contains("missing frame-ancestors"));
    }

    #[test]
    fn web_check_detects_cors_wildcard_with_credentials() {
        let mut headers = HeaderMap::new();
        headers.insert(ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
        headers.insert(
            ACCESS_CONTROL_ALLOW_CREDENTIALS,
            HeaderValue::from_static("true"),
        );

        let checks = analyze_cors_headers(&headers);

        assert!(checks.iter().any(|check| {
            check.name == ACCESS_CONTROL_ALLOW_ORIGIN.as_str()
                && check.severity == "warning"
                && check.message.contains("credentials")
        }));
    }

    #[test]
    fn web_check_analyzes_cookie_attributes() {
        let cookie = analyze_cookie("sid=abc; Secure; HttpOnly; SameSite=Lax", true);

        assert_eq!(cookie.name, "sid");
        assert!(cookie.secure);
        assert!(cookie.http_only);
        assert!(cookie.same_site);
        assert_eq!(cookie.same_site_value.as_deref(), Some("Lax"));
        assert_eq!(cookie.severity, "ok");
    }

    #[test]
    fn web_check_warns_for_missing_cookie_attributes() {
        let cookie = analyze_cookie("sid=abc", true);

        assert_eq!(cookie.severity, "warning");
        assert!(cookie.message.contains("Secure"));
        assert!(cookie.message.contains("HttpOnly"));
        assert!(cookie.message.contains("SameSite"));
    }

    #[test]
    fn web_check_warns_for_cookie_prefix_and_samesite_none_violations() {
        let host_cookie = analyze_cookie("__Host-sid=abc; Path=/app; HttpOnly; SameSite=Lax", true);
        let secure_cookie = analyze_cookie("__Secure-id=abc; HttpOnly; SameSite=None", true);

        assert_eq!(host_cookie.prefix_valid, Some(false));
        assert!(host_cookie.message.contains("__Host- prefix rules"));
        assert_eq!(secure_cookie.prefix_valid, Some(false));
        assert!(secure_cookie.message.contains("Secure for SameSite=None"));
    }

    #[test]
    fn web_check_parses_allowed_methods_and_detects_dangerous_methods() {
        let mut headers = HeaderMap::new();
        headers.insert(
            ALLOW,
            HeaderValue::from_static("get, POST, OPTIONS, TRACE, DELETE, GET"),
        );

        let methods = parse_allowed_methods(&headers);
        let dangerous = dangerous_allowed_methods(&methods);

        assert_eq!(methods, vec!["DELETE", "GET", "OPTIONS", "POST", "TRACE"]);
        assert_eq!(dangerous, vec!["DELETE", "TRACE"]);
    }

    #[test]
    fn web_check_extracts_form_candidates_from_target_html() {
        let target_url = Url::parse("https://example.com/search").unwrap();
        let html = r#"
            <form action="/submit" method="post">
              <input type="text" name="q">
              <textarea name='body'></textarea>
              <select name=kind></select>
            </form>
        "#;

        let forms = extract_form_candidates(html, &target_url);

        assert_eq!(forms.len(), 1);
        assert_eq!(forms[0].action, "/submit");
        assert_eq!(forms[0].method, "POST");
        assert_eq!(forms[0].inputs, vec!["body", "kind", "q"]);
    }

    #[test]
    fn web_check_detects_canary_reflection() {
        let result = build_input_check_result(
            "search".to_string(),
            "GET".to_string(),
            "https://example.com/search?q=HHT_CANARY_12345".to_string(),
            "q".to_string(),
            Some(200),
            "<html>HHT_CANARY_12345</html>",
            false,
            CANARY,
        );

        assert!(result.reflected);
        assert_eq!(result.severity, "warning");
        assert!(result.message.contains("reflected"));
    }
}
