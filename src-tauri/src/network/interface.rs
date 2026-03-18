use std::net::Ipv4Addr;

use default_net::get_default_interface;
use ipnetwork::Ipv4Network;
use pnet_datalink;

use crate::commands::network_info::NetworkInfo;
use crate::error::AppError;

/// Detect the active network interface and return its details.
/// Uses default-net for gateway detection, falls back to pnet_datalink iteration.
pub fn get_active_network_info() -> Result<NetworkInfo, AppError> {
    // Try default-net first for gateway-based detection
    if let Ok(default_if) = get_default_interface() {
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

            return Ok(NetworkInfo {
                ip_address: ip.to_string(),
                broadcast_address: broadcast.to_string(),
                interface_name: default_if.name.clone(),
                subnet_mask: mask.to_string(),
                gateway,
            });
        }
    }

    // Fallback: iterate pnet_datalink interfaces
    for iface in pnet_datalink::interfaces() {
        for ip_net in &iface.ips {
            if let std::net::IpAddr::V4(ipv4) = ip_net.ip() {
                if ipv4 == Ipv4Addr::LOCALHOST || ipv4.is_loopback() {
                    continue;
                }
                let prefix = ip_net.prefix();
                let network = Ipv4Network::new(ipv4, prefix)
                    .map_err(|e| AppError::Network(format!("Invalid network: {}", e)))?;

                return Ok(NetworkInfo {
                    ip_address: ipv4.to_string(),
                    broadcast_address: network.broadcast().to_string(),
                    interface_name: iface.name.clone(),
                    subnet_mask: network.mask().to_string(),
                    gateway: None,
                });
            }
        }
    }

    Err(AppError::Network(
        "Could not determine a suitable active network interface".to_string(),
    ))
}

/// Get the name of the active network interface.
pub fn get_interface_name() -> Result<String, AppError> {
    let info = get_active_network_info()?;
    Ok(info.interface_name)
}

/// Get the network prefix (e.g., "192.168.1.") for the active interface.
pub fn get_network_prefix() -> Result<(String, u8), AppError> {
    let info = get_active_network_info()?;
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

fn mask_to_prefix(mask: Ipv4Addr) -> u8 {
    let bits: u32 = u32::from(mask);
    bits.leading_ones() as u8
}
