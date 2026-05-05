use std::net::Ipv4Addr;

use futures::stream::{self, StreamExt};
use ipnetwork::Ipv4Network;
use tauri::{Emitter, Window};

use crate::commands::lan_scan::DeviceInfo;
use crate::config::AppConfig;
use crate::error::AppError;
use crate::network::{arp, interface, vendor};

/// Perform a LAN scan by sending ARP requests to the specified host range.
pub async fn scan(
    start: u8,
    end: u8,
    config: &AppConfig,
    client: &reqwest::Client,
    window: &Window,
) -> Result<Vec<DeviceInfo>, AppError> {
    let net_info = interface::get_active_network_info(&config.network)?;
    let ip: Ipv4Addr = net_info
        .ip_address
        .parse()
        .map_err(|e| AppError::Scan(format!("Invalid IP: {}", e)))?;
    let mask: Ipv4Addr = net_info
        .subnet_mask
        .parse()
        .map_err(|e| AppError::Scan(format!("Invalid mask: {}", e)))?;

    let targets = build_scan_targets(ip, mask, start, end)?;

    let interface_name = net_info.interface_name;
    let total = targets.len() as u32;
    let arp_timeout_ms = config.scan.arp_timeout_ms;
    let arp_retry_count = config.scan.lan_scan_arp_retry_count;
    let concurrency = config.scan.lan_scan_concurrency.max(1);
    let vendor_config = config.vendor.clone();
    let http_client = client.clone();
    let mut devices = Vec::new();
    let mut completed = 0_u32;

    let mut scan_results = stream::iter(targets)
        .map(|target_ip| {
            let target_str = target_ip.to_string();
            let interface_name = interface_name.clone();
            let vendor_config = vendor_config.clone();
            let http_client = http_client.clone();

            async move {
                let mac = tokio::task::spawn_blocking({
                    let target_str = target_str.clone();
                    move || {
                        arp::get_mac(
                            &target_str,
                            &interface_name,
                            arp_timeout_ms,
                            arp_retry_count,
                        )
                    }
                })
                .await
                .map_err(|e| AppError::Scan(format!("ARP task failed: {}", e)))??;

                let Some(mac_addr) = mac else {
                    return Ok::<(String, Option<DeviceInfo>), AppError>((target_str, None));
                };

                let hostname_task = tokio::task::spawn_blocking({
                    let target_str = target_str.clone();
                    move || lookup_hostname(&target_str)
                });
                let vendor_name = vendor::lookup_vendor(&mac_addr, &vendor_config, &http_client)
                    .await
                    .unwrap_or(None);
                let hostname = hostname_task
                    .await
                    .map_err(|e| AppError::Scan(format!("Hostname task failed: {}", e)))?;

                let device = DeviceInfo {
                    ip: target_str.clone(),
                    mac: Some(mac_addr),
                    hostname,
                    vendor_name,
                };

                Ok((target_str, Some(device)))
            }
        })
        .buffer_unordered(concurrency);

    while let Some(result) = scan_results.next().await {
        completed += 1;
        let (target_str, device) = result?;

        let _ = window.emit(
            "scan-progress",
            serde_json::json!({
                "current": completed,
                "total": total,
                "message": format!("Scanned {}", target_str),
            }),
        );

        if let Some(device) = device {
            let _ = window.emit("device-found", &device);
            devices.push(device);
        }
    }

    devices.sort_by_key(|device| device.ip.parse::<Ipv4Addr>().ok());

    Ok(devices)
}

fn build_scan_targets(
    ip: Ipv4Addr,
    mask: Ipv4Addr,
    start: u8,
    end: u8,
) -> Result<Vec<Ipv4Addr>, AppError> {
    let network = Ipv4Network::with_netmask(ip, mask)
        .map_err(|e| AppError::Scan(format!("Invalid network: {}", e)))?;
    let network_base = network.network();
    let broadcast = network.broadcast();
    let base_u32 = u32::from(network_base);
    let broadcast_u32 = u32::from(broadcast);
    let max_offset = broadcast_u32.saturating_sub(base_u32);

    // start/end は API 仕様上 u8 (0..=255) のため、/24 より広いネットワークでも
    // 「ネットワーク先頭から最大 256 ホスト分」のオフセットとして扱う。
    // /16 等をフルスキャンしたい場合は、API を u16 以上へ拡張して範囲指定を広げる。
    // ただし、実際に生成するIPは現在のサブネット境界内に制限する。
    let start_u32 = u32::from(start);
    if start_u32 > max_offset {
        return Ok(Vec::new());
    }
    let end_u32 = u32::from(end).min(max_offset);

    let targets = (start_u32..=end_u32)
        .map(|offset| Ipv4Addr::from(base_u32 + offset))
        .collect();

    Ok(targets)
}

fn lookup_hostname(ip: &str) -> Option<String> {
    use std::net::ToSocketAddrs;
    let addr = format!("{}:0", ip);
    if let Ok(mut addrs) = addr.to_socket_addrs() {
        if let Some(socket_addr) = addrs.next() {
            if let Ok(host) = dns_lookup::lookup_addr(&socket_addr.ip()) {
                if host != ip {
                    return Some(host);
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::build_scan_targets;
    use std::net::Ipv4Addr;

    #[test]
    fn build_scan_targets_for_24_network() {
        let ip = Ipv4Addr::new(192, 168, 1, 42);
        let mask = Ipv4Addr::new(255, 255, 255, 0);
        let targets = build_scan_targets(ip, mask, 1, 3).expect("target build should succeed");

        let expected = vec![
            Ipv4Addr::new(192, 168, 1, 1),
            Ipv4Addr::new(192, 168, 1, 2),
            Ipv4Addr::new(192, 168, 1, 3),
        ];
        assert_eq!(targets, expected);
    }

    #[test]
    fn build_scan_targets_for_16_network() {
        let ip = Ipv4Addr::new(10, 20, 30, 40);
        let mask = Ipv4Addr::new(255, 255, 0, 0);
        let targets = build_scan_targets(ip, mask, 254, 255).expect("target build should succeed");

        let expected = vec![Ipv4Addr::new(10, 20, 0, 254), Ipv4Addr::new(10, 20, 0, 255)];
        assert_eq!(targets, expected);
    }

    #[test]
    fn build_scan_targets_for_25_network_is_clamped_to_subnet() {
        let ip = Ipv4Addr::new(192, 168, 1, 200);
        let mask = Ipv4Addr::new(255, 255, 255, 128);
        let targets = build_scan_targets(ip, mask, 126, 255).expect("target build should succeed");

        let expected = vec![
            Ipv4Addr::new(192, 168, 1, 254),
            Ipv4Addr::new(192, 168, 1, 255),
        ];
        assert_eq!(targets, expected);
    }

    #[test]
    fn build_scan_targets_returns_empty_when_start_is_outside_subnet() {
        let ip = Ipv4Addr::new(192, 168, 1, 200);
        let mask = Ipv4Addr::new(255, 255, 255, 128);
        let targets = build_scan_targets(ip, mask, 200, 255).expect("target build should succeed");

        assert!(targets.is_empty());
    }
}
