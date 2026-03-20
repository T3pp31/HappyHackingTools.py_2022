use std::net::Ipv4Addr;
use std::time::Duration;

use pnet::packet::arp::ArpOperations;
use pnet::util::MacAddr;
use pnet_datalink::{self, Channel};

use crate::error::AppError;
use crate::network::packet;

/// Send an ARP request and return the MAC address if a reply is received.
pub fn get_mac(
    ip_address: &str,
    interface_name: &str,
    timeout_ms: u64,
    retry_count: u32,
) -> Result<Option<String>, AppError> {
    let target_ip: Ipv4Addr = ip_address
        .parse()
        .map_err(|e| AppError::Network(format!("Invalid IP address: {}", e)))?;

    let interface = packet::find_interface(interface_name)?;
    let source_mac = interface
        .mac
        .ok_or_else(|| AppError::Network("Interface has no MAC address".to_string()))?;

    let source_ip = interface
        .ips
        .iter()
        .find_map(|ip_net| {
            if let std::net::IpAddr::V4(ipv4) = ip_net.ip() {
                if !ipv4.is_loopback() {
                    return Some(ipv4);
                }
            }
            None
        })
        .ok_or_else(|| AppError::Network("Interface has no IPv4 address".to_string()))?;

    for _ in 0..retry_count {
        if let Some(mac) =
            send_arp_request(&interface, source_mac, source_ip, target_ip, timeout_ms)?
        {
            return Ok(Some(mac.to_string()));
        }
    }

    Ok(None)
}

fn send_arp_request(
    interface: &pnet_datalink::NetworkInterface,
    source_mac: MacAddr,
    source_ip: Ipv4Addr,
    target_ip: Ipv4Addr,
    timeout_ms: u64,
) -> Result<Option<MacAddr>, AppError> {
    let config = pnet_datalink::Config {
        read_timeout: Some(Duration::from_millis(timeout_ms)),
        ..Default::default()
    };

    let (mut tx, mut rx) = match pnet_datalink::channel(interface, config) {
        Ok(Channel::Ethernet(tx, rx)) => (tx, rx),
        Ok(_) => return Err(AppError::Network("Unsupported channel type".to_string())),
        Err(e) => {
            return Err(AppError::Network(format!(
                "Failed to create datalink channel: {}",
                e
            )))
        }
    };

    // Build ARP request frame
    let ethernet_buffer =
        packet::build_arp_packet(ArpOperations::Request, source_mac, source_ip, MacAddr::zero(), target_ip)?;

    tx.send_to(&ethernet_buffer, None)
        .ok_or_else(|| AppError::Network("Failed to send ARP packet".to_string()))?
        .map_err(|e| AppError::Network(format!("Send error: {}", e)))?;

    // Receive response
    let deadline = std::time::Instant::now() + Duration::from_millis(timeout_ms);
    while std::time::Instant::now() < deadline {
        match rx.next() {
            Ok(data) => {
                if let Some(arp_reply) =
                    pnet::packet::arp::ArpPacket::new(&data[packet::ETHERNET_HEADER_SIZE..])
                {
                    if arp_reply.get_operation() == ArpOperations::Reply
                        && arp_reply.get_sender_proto_addr() == target_ip
                    {
                        return Ok(Some(arp_reply.get_sender_hw_addr()));
                    }
                }
            }
            Err(_) => break,
        }
    }

    Ok(None)
}
