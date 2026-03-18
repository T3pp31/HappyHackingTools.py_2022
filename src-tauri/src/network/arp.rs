use std::net::Ipv4Addr;
use std::time::Duration;

use pnet::packet::arp::{ArpHardwareTypes, ArpOperations, MutableArpPacket};
use pnet::packet::ethernet::{EtherTypes, MutableEthernetPacket};
use pnet::packet::MutablePacket;
use pnet::util::MacAddr;
use pnet_datalink::{self, Channel, NetworkInterface};

use crate::error::AppError;

const ARP_PACKET_SIZE: usize = 28;
const ETHERNET_HEADER_SIZE: usize = 14;
const TOTAL_FRAME_SIZE: usize = ETHERNET_HEADER_SIZE + ARP_PACKET_SIZE;
const BROADCAST_MAC: MacAddr = MacAddr(0xff, 0xff, 0xff, 0xff, 0xff, 0xff);

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

    let interface = find_interface(interface_name)?;
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

fn find_interface(name: &str) -> Result<NetworkInterface, AppError> {
    pnet_datalink::interfaces()
        .into_iter()
        .find(|iface| iface.name == name)
        .ok_or_else(|| AppError::Network(format!("Interface '{}' not found", name)))
}

fn send_arp_request(
    interface: &NetworkInterface,
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
    let mut ethernet_buffer = [0u8; TOTAL_FRAME_SIZE];
    {
        let mut ethernet_packet =
            MutableEthernetPacket::new(&mut ethernet_buffer).ok_or_else(|| {
                AppError::Network("Failed to create Ethernet packet".to_string())
            })?;

        ethernet_packet.set_destination(BROADCAST_MAC);
        ethernet_packet.set_source(source_mac);
        ethernet_packet.set_ethertype(EtherTypes::Arp);

        let mut arp_packet =
            MutableArpPacket::new(ethernet_packet.payload_mut()).ok_or_else(|| {
                AppError::Network("Failed to create ARP packet".to_string())
            })?;

        arp_packet.set_hardware_type(ArpHardwareTypes::Ethernet);
        arp_packet.set_protocol_type(EtherTypes::Ipv4);
        arp_packet.set_hw_addr_len(6);
        arp_packet.set_proto_addr_len(4);
        arp_packet.set_operation(ArpOperations::Request);
        arp_packet.set_sender_hw_addr(source_mac);
        arp_packet.set_sender_proto_addr(source_ip);
        arp_packet.set_target_hw_addr(MacAddr::zero());
        arp_packet.set_target_proto_addr(target_ip);
    }

    tx.send_to(&ethernet_buffer, None)
        .ok_or_else(|| AppError::Network("Failed to send ARP packet".to_string()))?
        .map_err(|e| AppError::Network(format!("Send error: {}", e)))?;

    // Receive response
    let deadline = std::time::Instant::now() + Duration::from_millis(timeout_ms);
    while std::time::Instant::now() < deadline {
        match rx.next() {
            Ok(packet) => {
                if let Some(arp_reply) =
                    pnet::packet::arp::ArpPacket::new(&packet[ETHERNET_HEADER_SIZE..])
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
