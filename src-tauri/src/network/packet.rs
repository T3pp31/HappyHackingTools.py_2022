use std::net::Ipv4Addr;

use pnet::packet::arp::{ArpHardwareTypes, ArpOperation, ArpOperations, MutableArpPacket};
use pnet::packet::ethernet::{EtherTypes, MutableEthernetPacket};
use pnet::packet::MutablePacket;
use pnet::util::MacAddr;
use pnet_datalink::NetworkInterface;

use crate::error::AppError;

pub const ARP_PACKET_SIZE: usize = 28;
pub const ETHERNET_HEADER_SIZE: usize = 14;
pub const TOTAL_FRAME_SIZE: usize = ETHERNET_HEADER_SIZE + ARP_PACKET_SIZE;
pub const BROADCAST_MAC: MacAddr = MacAddr(0xff, 0xff, 0xff, 0xff, 0xff, 0xff);

/// Find a network interface by name.
pub fn find_interface(name: &str) -> Result<NetworkInterface, AppError> {
    pnet_datalink::interfaces()
        .into_iter()
        .find(|iface| iface.name == name)
        .ok_or_else(|| AppError::Network(format!("Interface '{}' not found", name)))
}

/// Build a complete Ethernet+ARP frame.
///
/// For ARP Request: destination MAC is BROADCAST_MAC and target hardware address is zero.
/// For ARP Reply: destination MAC is target_mac and target hardware address is target_mac.
pub fn build_arp_packet(
    operation: ArpOperation,
    sender_mac: MacAddr,
    sender_ip: Ipv4Addr,
    target_mac: MacAddr,
    target_ip: Ipv4Addr,
) -> Result<[u8; TOTAL_FRAME_SIZE], AppError> {
    let mut buffer = [0u8; TOTAL_FRAME_SIZE];

    let (destination, target_hw_addr) = if operation == ArpOperations::Request {
        (BROADCAST_MAC, MacAddr::zero())
    } else {
        (target_mac, target_mac)
    };

    {
        let mut ethernet_packet =
            MutableEthernetPacket::new(&mut buffer).ok_or_else(|| {
                AppError::Network("Failed to create Ethernet packet".to_string())
            })?;

        ethernet_packet.set_destination(destination);
        ethernet_packet.set_source(sender_mac);
        ethernet_packet.set_ethertype(EtherTypes::Arp);

        let mut arp_packet =
            MutableArpPacket::new(ethernet_packet.payload_mut()).ok_or_else(|| {
                AppError::Network("Failed to create ARP packet".to_string())
            })?;

        arp_packet.set_hardware_type(ArpHardwareTypes::Ethernet);
        arp_packet.set_protocol_type(EtherTypes::Ipv4);
        arp_packet.set_hw_addr_len(6);
        arp_packet.set_proto_addr_len(4);
        arp_packet.set_operation(operation);
        arp_packet.set_sender_hw_addr(sender_mac);
        arp_packet.set_sender_proto_addr(sender_ip);
        arp_packet.set_target_hw_addr(target_hw_addr);
        arp_packet.set_target_proto_addr(target_ip);
    }

    Ok(buffer)
}

/// Send an ARP reply packet through the given datalink sender.
pub fn send_arp_reply(
    tx: &mut Box<dyn pnet_datalink::DataLinkSender>,
    sender_mac: MacAddr,
    sender_ip: Ipv4Addr,
    target_mac: MacAddr,
    target_ip: Ipv4Addr,
) {
    if let Ok(buffer) = build_arp_packet(
        ArpOperations::Reply,
        sender_mac,
        sender_ip,
        target_mac,
        target_ip,
    ) {
        let _ = tx.send_to(&buffer, None);
    }
}
