use std::net::Ipv4Addr;

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

    let interface_name = &net_info.interface_name;
    let total = (end as u32).saturating_sub(start as u32) + 1;
    let mut devices = Vec::new();

    for (index, target_ip) in targets.into_iter().enumerate() {
        let target_str = target_ip.to_string();

        // Emit progress
        let _ = window.emit(
            "scan-progress",
            serde_json::json!({
                "current": index as u32 + 1,
                "total": total,
                "message": format!("Scanning {}", target_str),
            }),
        );

        let mac = arp::get_mac(
            &target_str,
            interface_name,
            config.scan.arp_timeout_ms,
            config.scan.lan_scan_arp_retry_count,
        )?;

        if let Some(ref mac_addr) = mac {
            let hostname = lookup_hostname(&target_str);
            let vendor_name = vendor::lookup_vendor(mac_addr, &config.vendor, client)
                .await
                .unwrap_or(None);

            let device = DeviceInfo {
                ip: target_str,
                mac: Some(mac_addr.clone()),
                hostname,
                vendor_name,
            };

            // Emit device found event
            let _ = window.emit("device-found", &device);
            devices.push(device);
        }
    }

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
    let base_u32 = u32::from(network_base);

    // start/end は API 仕様上 u8 (0..=255) のため、/24 より広いネットワークでも
    // 「ネットワーク先頭から最大 256 ホスト分」のオフセットとして扱う。
    // /16 等をフルスキャンしたい場合は、API を u16 以上へ拡張して範囲指定を広げる。
    let targets = (start..=end)
        .map(|offset| Ipv4Addr::from(base_u32 + u32::from(offset)))
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
}
