use std::net::Ipv4Addr;

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
    window: &Window,
) -> Result<Vec<DeviceInfo>, AppError> {
    let net_info = interface::get_active_network_info()?;
    let ip: Ipv4Addr = net_info
        .ip_address
        .parse()
        .map_err(|e| AppError::Scan(format!("Invalid IP: {}", e)))?;
    let mask: Ipv4Addr = net_info
        .subnet_mask
        .parse()
        .map_err(|e| AppError::Scan(format!("Invalid mask: {}", e)))?;

    // Calculate network base address
    let ip_octets = ip.octets();
    let mask_octets = mask.octets();
    let network_base: [u8; 4] = [
        ip_octets[0] & mask_octets[0],
        ip_octets[1] & mask_octets[1],
        ip_octets[2] & mask_octets[2],
        0,
    ];

    let interface_name = &net_info.interface_name;
    let total = (end as u32).saturating_sub(start as u32) + 1;
    let mut devices = Vec::new();

    for i in start..=end {
        let target_ip = Ipv4Addr::new(network_base[0], network_base[1], network_base[2], i);
        let target_str = target_ip.to_string();

        // Emit progress
        let _ = window.emit(
            "scan-progress",
            serde_json::json!({
                "current": (i as u32) - (start as u32) + 1,
                "total": total,
                "message": format!("Scanning {}", target_str),
            }),
        );

        let mac = arp::get_mac(
            &target_str,
            interface_name,
            config.scan.arp_timeout_ms,
            1, // Single attempt per IP for speed
        )?;

        if let Some(ref mac_addr) = mac {
            let hostname = lookup_hostname(&target_str);
            let vendor_name = vendor::lookup_vendor(mac_addr, &config.vendor)
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
