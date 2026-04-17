use std::net::{Ipv4Addr, SocketAddrV4};
use std::time::Duration;

use futures::stream::{self, StreamExt};
use tauri::{Emitter, Window};
use tokio::net::TcpStream;
use tokio::time::timeout;

use crate::commands::port_scan::PortScanResult;
use crate::config::AppConfig;
use crate::error::AppError;

/// Perform an async TCP connect scan on the specified IP and port range.
pub async fn scan(
    ip: &str,
    port_start: u16,
    port_end: u16,
    config: &AppConfig,
    window: &Window,
) -> Result<PortScanResult, AppError> {
    let target_ip: Ipv4Addr = ip
        .parse()
        .map_err(|e| AppError::Scan(format!("Invalid IP address: {}", e)))?;

    let (actual_start, actual_end) = if port_start <= port_end {
        (port_start, port_end)
    } else {
        (port_end, port_start)
    };

    let total = (actual_end as u32) - (actual_start as u32) + 1;
    let connect_timeout = Duration::from_millis(config.scan.port_scan_timeout_ms);

    let mut open_ports = Vec::new();
    let mut completed: u32 = 0;

    let mut scan_stream = stream::iter(actual_start..=actual_end)
        .map(|port| {
            let addr = SocketAddrV4::new(target_ip, port);
            let window_clone = window.clone();
            let ip_str = ip.to_string();

            async move {
                let is_open = timeout(connect_timeout, TcpStream::connect(addr))
                    .await
                    .map(|result| result.is_ok())
                    .unwrap_or(false);

                if is_open {
                    let _ = window_clone.emit(
                        "port-found",
                        serde_json::json!({
                            "port": port,
                            "ip": ip_str,
                        }),
                    );
                }

                (port, is_open)
            }
        })
        .buffer_unordered(config.scan.port_scan_concurrency as usize);

    while let Some((port, is_open)) = scan_stream.next().await {
        completed += 1;

        if is_open {
            open_ports.push(port);
        }

        // Emit progress at configured interval to avoid flooding
        if completed % config.scan.progress_report_interval == 0 || completed == total {
            let _ = window.emit(
                "scan-progress",
                serde_json::json!({
                    "current": completed,
                    "total": total,
                    "message": format!("Scanned {}/{} ports", completed, total),
                }),
            );
        }
    }

    open_ports.sort();

    Ok(PortScanResult {
        ip: ip.to_string(),
        open_ports,
        scanned_range: (actual_start, actual_end),
    })
}
