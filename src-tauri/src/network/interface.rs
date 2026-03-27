use std::net::{Ipv4Addr, UdpSocket};

use default_net::get_default_interface;
use ipnetwork::Ipv4Network;
use pnet_datalink;

use crate::commands::network_info::NetworkInfo;
use crate::config::NetworkConfig;
use crate::error::AppError;

/// Default prefix length assumed when enrichment fails.
const DEFAULT_PREFIX_LEN: u8 = 24;

/// Detect the active network interface and return its details.
/// Uses default-net for gateway detection, falls back to pnet_datalink iteration,
/// then to a Npcap-independent UDP socket probe with platform-specific enrichment.
pub fn get_active_network_info(config: &NetworkConfig) -> Result<NetworkInfo, AppError> {
    let mut step_errors: Vec<String> = Vec::new();

    // Step 1: default-net for gateway-based detection
    match get_default_interface() {
        Ok(default_if) => {
            for ipv4_info in &default_if.ipv4 {
                let ip = ipv4_info.addr;
                let prefix = ipv4_info.prefix_len;
                let network = Ipv4Network::new(ip, prefix)
                    .map_err(|e| AppError::Network(format!("Invalid network: {}", e)))?;
                let mask = network.mask();
                let broadcast = network.broadcast();

                let gateway = default_if
                    .gateway
                    .as_ref()
                    .map(|gw| gw.ip_addr.to_string());

                log::info!(
                    "Step 1 (default-net): detected interface '{}' with IP {}",
                    default_if.name,
                    ip
                );

                return Ok(NetworkInfo {
                    ip_address: ip.to_string(),
                    broadcast_address: broadcast.to_string(),
                    interface_name: default_if.name.clone(),
                    subnet_mask: mask.to_string(),
                    gateway,
                });
            }
            step_errors.push("Step 1 (default-net): no IPv4 address found on default interface".to_string());
        }
        Err(e) => {
            let msg = format!("Step 1 (default-net): {}", e);
            log::warn!("{}", msg);
            step_errors.push(msg);
        }
    }

    // Step 2: pnet_datalink interfaces (requires Npcap on Windows)
    if crate::network::npcap::is_npcap_available() {
        let mut found_any = false;
        for iface in pnet_datalink::interfaces() {
            for ip_net in &iface.ips {
                if let std::net::IpAddr::V4(ipv4) = ip_net.ip() {
                    if ipv4 == Ipv4Addr::LOCALHOST || ipv4.is_loopback() {
                        continue;
                    }
                    let prefix = ip_net.prefix();
                    let network = Ipv4Network::new(ipv4, prefix)
                        .map_err(|e| AppError::Network(format!("Invalid network: {}", e)))?;

                    log::info!(
                        "Step 2 (pnet_datalink): detected interface '{}' with IP {}",
                        iface.name,
                        ipv4
                    );

                    return Ok(NetworkInfo {
                        ip_address: ipv4.to_string(),
                        broadcast_address: network.broadcast().to_string(),
                        interface_name: iface.name.clone(),
                        subnet_mask: network.mask().to_string(),
                        gateway: None,
                    });
                }
            }
            found_any = true;
        }
        if !found_any {
            step_errors.push("Step 2 (pnet_datalink): no interfaces found".to_string());
        } else {
            step_errors.push("Step 2 (pnet_datalink): no suitable IPv4 interface found".to_string());
        }
    } else {
        let msg = "Step 2 (pnet_datalink): skipped (Npcap not available)".to_string();
        log::warn!("{}", msg);
        step_errors.push(msg);
    }

    // Step 3: UDP socket probe (Npcap-independent fallback)
    match detect_via_udp_socket(&config.udp_probe_target) {
        Some(local_ip) => {
            log::info!("Step 3 (UDP probe): detected local IP {}", local_ip);

            // Platform-specific enrichment
            if let Some(info) = enrich_from_platform(local_ip) {
                log::info!(
                    "Step 3 (enrichment): interface '{}', mask {}, gateway {:?}",
                    info.interface_name,
                    info.subnet_mask,
                    info.gateway
                );
                return Ok(info);
            }

            log::warn!("Step 3 (enrichment): failed, using minimal /24 info");
            return Ok(build_minimal_info(local_ip));
        }
        None => {
            let msg = format!(
                "Step 3 (UDP probe): could not determine local IP via {}",
                config.udp_probe_target
            );
            log::warn!("{}", msg);
            step_errors.push(msg);
        }
    }

    let combined = step_errors.join("; ");
    Err(AppError::Network(format!(
        "Could not determine a suitable active network interface. Details: {}",
        combined
    )))
}

/// Get the name of the active network interface.
#[allow(dead_code)]
pub fn get_interface_name(config: &NetworkConfig) -> Result<String, AppError> {
    let info = get_active_network_info(config)?;
    Ok(info.interface_name)
}

/// Get the network prefix (e.g., "192.168.1.") for the active interface.
#[allow(dead_code)]
pub fn get_network_prefix(config: &NetworkConfig) -> Result<(String, u8), AppError> {
    let info = get_active_network_info(config)?;
    let ip: Ipv4Addr = info
        .ip_address
        .parse()
        .map_err(|e| AppError::Network(format!("Invalid IP: {}", e)))?;
    let mask: Ipv4Addr = info
        .subnet_mask
        .parse()
        .map_err(|e| AppError::Network(format!("Invalid mask: {}", e)))?;

    let network = Ipv4Network::new(ip, mask_to_prefix(mask))
        .map_err(|e| AppError::Network(format!("Invalid network: {}", e)))?;

    Ok((network.network().to_string(), network.prefix()))
}

#[allow(dead_code)]
fn mask_to_prefix(mask: Ipv4Addr) -> u8 {
    let bits: u32 = u32::from(mask);
    bits.leading_ones() as u8
}

/// Detect the local IP address by connecting a UDP socket to the probe target.
/// This does not send any actual traffic; it merely asks the OS for the route.
fn detect_via_udp_socket(probe_target: &str) -> Option<Ipv4Addr> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect(probe_target).ok()?;
    let local_addr = socket.local_addr().ok()?;
    match local_addr.ip() {
        std::net::IpAddr::V4(ipv4) => Some(ipv4),
        _ => None,
    }
}

/// Build minimal NetworkInfo assuming a /24 network when enrichment fails.
fn build_minimal_info(ip: Ipv4Addr) -> NetworkInfo {
    let network = Ipv4Network::new(ip, DEFAULT_PREFIX_LEN)
        .unwrap_or_else(|_| Ipv4Network::new(ip, DEFAULT_PREFIX_LEN).unwrap());
    NetworkInfo {
        ip_address: ip.to_string(),
        broadcast_address: network.broadcast().to_string(),
        interface_name: "unknown".to_string(),
        subnet_mask: network.mask().to_string(),
        gateway: None,
    }
}

/// Platform-specific enrichment dispatcher.
#[cfg(target_os = "windows")]
fn enrich_from_platform(ip: Ipv4Addr) -> Option<NetworkInfo> {
    enrich_from_netsh(ip)
}

#[cfg(not(target_os = "windows"))]
fn enrich_from_platform(ip: Ipv4Addr) -> Option<NetworkInfo> {
    enrich_from_ip_command(ip)
}

/// Windows: Parse `netsh interface ipv4 show addresses` to extract network details.
#[cfg(target_os = "windows")]
fn enrich_from_netsh(ip: Ipv4Addr) -> Option<NetworkInfo> {
    let output = std::process::Command::new("netsh")
        .args(["interface", "ipv4", "show", "addresses"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let ip_str = ip.to_string();

    // Split into sections by empty lines
    let sections: Vec<&str> = stdout.split("\r\n\r\n").collect();

    for section in &sections {
        if !section.contains(&ip_str) {
            continue;
        }

        let lines: Vec<&str> = section.lines().collect();

        // Extract interface name from the first line (within quotes)
        let iface_name = extract_quoted_string(lines.first().unwrap_or(&""));

        // Extract subnet mask (look for "mask" or Japanese equivalent)
        let subnet_mask = find_ip_after_keyword(section, &["mask", "マスク"]);

        // Extract gateway: look for the last IP-like pattern in the section
        let gateway = find_gateway_ip(section);

        let mask_str = subnet_mask.unwrap_or_else(|| "255.255.255.0".to_string());
        let mask_addr: Ipv4Addr = mask_str.parse().unwrap_or(Ipv4Addr::new(255, 255, 255, 0));
        let prefix = mask_to_prefix(mask_addr);
        let network = Ipv4Network::new(ip, prefix).ok()?;

        return Some(NetworkInfo {
            ip_address: ip_str.clone(),
            broadcast_address: network.broadcast().to_string(),
            interface_name: iface_name.unwrap_or_else(|| "unknown".to_string()),
            subnet_mask: mask_str,
            gateway,
        });
    }

    None
}

/// Linux: Parse `ip -4 addr show` to extract network details.
#[cfg(not(target_os = "windows"))]
fn enrich_from_ip_command(ip: Ipv4Addr) -> Option<NetworkInfo> {
    let output = std::process::Command::new("ip")
        .args(["-4", "addr", "show"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let ip_str = ip.to_string();
    let lines: Vec<&str> = stdout.lines().collect();

    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        // Match lines like: "inet 192.168.1.100/24 ..."
        if !trimmed.starts_with("inet ") {
            continue;
        }
        let after_inet = &trimmed["inet ".len()..];
        let cidr = after_inet.split_whitespace().next().unwrap_or("");

        let parts: Vec<&str> = cidr.split('/').collect();
        if parts.len() != 2 {
            continue;
        }

        if parts[0] != ip_str {
            continue;
        }

        let prefix: u8 = parts[1].parse().ok()?;
        let network = Ipv4Network::new(ip, prefix).ok()?;

        // Interface name is on a preceding line like "2: eth0: <...>"
        let iface_name = find_interface_name_above(&lines, i);

        return Some(NetworkInfo {
            ip_address: ip_str.clone(),
            broadcast_address: network.broadcast().to_string(),
            interface_name: iface_name.unwrap_or_else(|| "unknown".to_string()),
            subnet_mask: network.mask().to_string(),
            gateway: None,
        });
    }

    None
}

/// Extract a string enclosed in double quotes from a line.
#[cfg(target_os = "windows")]
fn extract_quoted_string(line: &str) -> Option<String> {
    let start = line.find('"')?;
    let rest = &line[start + 1..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

/// Find an IP address pattern on a line containing any of the given keywords.
#[cfg(target_os = "windows")]
fn find_ip_after_keyword(text: &str, keywords: &[&str]) -> Option<String> {
    for line in text.lines() {
        let lower = line.to_lowercase();
        let matches_keyword = keywords.iter().any(|kw| lower.contains(&kw.to_lowercase()));
        if !matches_keyword {
            continue;
        }
        if let Some(ip) = extract_ip_from_line(line) {
            return Some(ip);
        }
    }
    None
}

/// Find a gateway IP address in a netsh section.
/// The gateway line typically contains "gateway" or "ゲートウェイ".
#[cfg(target_os = "windows")]
fn find_gateway_ip(section: &str) -> Option<String> {
    for line in section.lines() {
        let lower = line.to_lowercase();
        if lower.contains("gateway") || lower.contains("ゲートウェイ") {
            return extract_ip_from_line(line);
        }
    }
    None
}

/// Extract the first IPv4 address pattern from a line.
#[allow(dead_code)]
fn extract_ip_from_line(line: &str) -> Option<String> {
    for word in line.split_whitespace() {
        let cleaned = word.trim_matches(|c: char| !c.is_ascii_digit() && c != '.');
        if is_ipv4_pattern(cleaned) {
            return Some(cleaned.to_string());
        }
    }
    None
}

/// Check if a string looks like an IPv4 address (4 dot-separated numeric octets).
#[allow(dead_code)]
fn is_ipv4_pattern(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    parts.iter().all(|p| {
        !p.is_empty() && p.len() <= 3 && p.chars().all(|c| c.is_ascii_digit())
    })
}

/// Find the interface name from a line above the current index in `ip addr show` output.
/// Lines like "2: eth0: <BROADCAST,...>" contain the interface name.
#[cfg(not(target_os = "windows"))]
fn find_interface_name_above(lines: &[&str], current_idx: usize) -> Option<String> {
    for i in (0..current_idx).rev() {
        let line = lines[i];
        // Interface header lines start with a number like "2: eth0:"
        if let Some(colon_pos) = line.find(':') {
            let before_colon = line[..colon_pos].trim();
            if before_colon.chars().all(|c| c.is_ascii_digit()) && !before_colon.is_empty() {
                // Found the header line; extract the interface name
                let rest = &line[colon_pos + 1..];
                if let Some(second_colon) = rest.find(':') {
                    let name = rest[..second_colon].trim();
                    if !name.is_empty() {
                        return Some(name.to_string());
                    }
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mask_to_prefix_24() {
        let mask = Ipv4Addr::new(255, 255, 255, 0);
        assert_eq!(mask_to_prefix(mask), 24);
    }

    #[test]
    fn test_mask_to_prefix_16() {
        let mask = Ipv4Addr::new(255, 255, 0, 0);
        assert_eq!(mask_to_prefix(mask), 16);
    }

    #[test]
    fn test_mask_to_prefix_32() {
        let mask = Ipv4Addr::new(255, 255, 255, 255);
        assert_eq!(mask_to_prefix(mask), 32);
    }

    #[test]
    fn test_mask_to_prefix_0() {
        let mask = Ipv4Addr::new(0, 0, 0, 0);
        assert_eq!(mask_to_prefix(mask), 0);
    }

    #[test]
    fn test_is_ipv4_pattern_valid() {
        assert!(is_ipv4_pattern("192.168.1.1"));
        assert!(is_ipv4_pattern("0.0.0.0"));
        assert!(is_ipv4_pattern("255.255.255.255"));
        assert!(is_ipv4_pattern("10.0.0.1"));
    }

    #[test]
    fn test_is_ipv4_pattern_invalid() {
        assert!(!is_ipv4_pattern("192.168.1"));
        assert!(!is_ipv4_pattern("192.168.1.1.1"));
        assert!(!is_ipv4_pattern("abc.def.ghi.jkl"));
        assert!(!is_ipv4_pattern(""));
        assert!(!is_ipv4_pattern("192.168.1."));
        assert!(!is_ipv4_pattern("1234.1.1.1"));
    }

    #[test]
    fn test_extract_ip_from_line() {
        assert_eq!(
            extract_ip_from_line("   Subnet Mask: 255.255.255.0"),
            Some("255.255.255.0".to_string())
        );
        assert_eq!(
            extract_ip_from_line("   Default Gateway: 192.168.1.1"),
            Some("192.168.1.1".to_string())
        );
        assert_eq!(extract_ip_from_line("no ip here"), None);
        assert_eq!(extract_ip_from_line(""), None);
    }

    #[test]
    fn test_build_minimal_info() {
        let ip = Ipv4Addr::new(192, 168, 1, 100);
        let info = build_minimal_info(ip);
        assert_eq!(info.ip_address, "192.168.1.100");
        assert_eq!(info.subnet_mask, "255.255.255.0");
        assert_eq!(info.broadcast_address, "192.168.1.255");
        assert_eq!(info.interface_name, "unknown");
        assert!(info.gateway.is_none());
    }

    #[test]
    fn test_build_minimal_info_class_a() {
        let ip = Ipv4Addr::new(10, 0, 5, 42);
        let info = build_minimal_info(ip);
        assert_eq!(info.ip_address, "10.0.5.42");
        assert_eq!(info.subnet_mask, "255.255.255.0");
        assert_eq!(info.broadcast_address, "10.0.5.255");
    }

    #[test]
    fn test_detect_via_udp_socket_invalid_target() {
        // Invalid target should return None
        assert!(detect_via_udp_socket("not_an_address").is_none());
    }
}
