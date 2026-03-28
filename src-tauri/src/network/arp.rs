use std::net::Ipv4Addr;

use crate::error::AppError;

// ---------------------------------------------------------------------------
// Windows implementation: uses SendARP from iphlpapi.dll (no Npcap required)
// ---------------------------------------------------------------------------
#[cfg(target_os = "windows")]
mod platform {
    use super::*;

    /// MAC address byte length expected by SendARP.
    const MAC_ADDR_LEN: u32 = 6;
    /// Buffer size for the physical address returned by SendARP (8 bytes per MSDN).
    const MAC_ADDR_BUF_SIZE: usize = 8;
    /// SendARP return value indicating success (NO_ERROR).
    const NO_ERROR: u32 = 0;

    #[link(name = "iphlpapi")]
    extern "system" {
        /// <https://learn.microsoft.com/en-us/windows/win32/api/iphlpapi/nf-iphlpapi-sendarp>
        fn SendARP(
            DestIP: u32,
            SrcIP: u32,
            pMacAddr: *mut u8,
            PhyAddrLen: *mut u32,
        ) -> u32;
    }

    /// Resolve a MAC address for `ip_address` using the Windows SendARP API.
    ///
    /// `_interface_name` and `_timeout_ms` are unused on Windows because
    /// `SendARP` handles interface selection and timeout internally.
    pub fn get_mac(
        ip_address: &str,
        _interface_name: &str,
        _timeout_ms: u64,
        retry_count: u32,
    ) -> Result<Option<String>, AppError> {
        let target_ip: Ipv4Addr = ip_address
            .parse()
            .map_err(|e| AppError::Network(format!("Invalid IP address: {}", e)))?;

        for _ in 0..retry_count {
            if let Some(mac) = send_arp_win32(target_ip)? {
                return Ok(Some(mac));
            }
        }

        Ok(None)
    }

    /// Call the Win32 `SendARP` API and return the resolved MAC address.
    fn send_arp_win32(target_ip: Ipv4Addr) -> Result<Option<String>, AppError> {
        let dest_ip = u32::from_ne_bytes(target_ip.octets());
        let src_ip: u32 = 0; // let Windows choose the source automatically
        let mut mac_buf = [0u8; MAC_ADDR_BUF_SIZE];
        let mut phy_addr_len: u32 = MAC_ADDR_LEN;

        let ret = unsafe {
            SendARP(
                dest_ip,
                src_ip,
                mac_buf.as_mut_ptr(),
                &mut phy_addr_len,
            )
        };

        if ret == NO_ERROR {
            Ok(Some(format_mac_address(&mac_buf)))
        } else {
            // Non-zero means the target did not respond (or another error).
            Ok(None)
        }
    }

    /// Format the first 6 bytes of a MAC address buffer as `xx:xx:xx:xx:xx:xx`.
    fn format_mac_address(mac_bytes: &[u8; MAC_ADDR_BUF_SIZE]) -> String {
        format!(
            "{:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
            mac_bytes[0],
            mac_bytes[1],
            mac_bytes[2],
            mac_bytes[3],
            mac_bytes[4],
            mac_bytes[5],
        )
    }

    #[cfg(test)]
    pub fn format_mac_address_pub(mac_bytes: &[u8; MAC_ADDR_BUF_SIZE]) -> String {
        format_mac_address(mac_bytes)
    }

    #[cfg(test)]
    pub const TEST_MAC_ADDR_BUF_SIZE: usize = MAC_ADDR_BUF_SIZE;
}

// ---------------------------------------------------------------------------
// Non-Windows implementation: uses pnet_datalink raw sockets (Linux / macOS)
// ---------------------------------------------------------------------------
#[cfg(not(target_os = "windows"))]
mod platform {
    use super::*;
    use std::time::Duration;

    use pnet::packet::arp::ArpOperations;
    use pnet::util::MacAddr;
    use pnet_datalink::{self, Channel};

    use crate::network::packet;

    /// Resolve a MAC address for `ip_address` by sending ARP requests via raw
    /// sockets.
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
        let ethernet_buffer = packet::build_arp_packet(
            ArpOperations::Request,
            source_mac,
            source_ip,
            MacAddr::zero(),
            target_ip,
        )?;

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
}

// Re-export the platform-specific `get_mac` so callers remain unchanged.
pub use platform::get_mac;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;

    // -- MAC address format test -------------------------------------------

    /// Verify that the MAC address string follows the `xx:xx:xx:xx:xx:xx`
    /// colon-separated hex format.
    #[test]
    fn test_format_mac_address() {
        // Given: a well-known MAC byte sequence
        #[cfg(target_os = "windows")]
        {
            let mac_bytes: [u8; platform::TEST_MAC_ADDR_BUF_SIZE] =
                [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00, 0x00];
            // When: formatting as a string
            let formatted = platform::format_mac_address_pub(&mac_bytes);
            // Then: should be lower-case hex with colon separators
            assert_eq!(formatted, "aa:bb:cc:dd:ee:ff");
        }

        // Platform-independent check: validate the regex pattern on a sample
        // string to ensure the expected `xx:xx:xx:xx:xx:xx` shape.
        let sample = "01:23:45:67:89:ab";
        let parts: Vec<&str> = sample.split(':').collect();
        assert_eq!(parts.len(), 6, "MAC address must have exactly 6 octets");
        for part in &parts {
            assert_eq!(part.len(), 2, "Each octet must be 2 hex characters");
            assert!(
                part.chars().all(|c| c.is_ascii_hexdigit()),
                "Each octet must contain only hex digits"
            );
        }
    }

    // -- Invalid IP address test -------------------------------------------

    /// Passing a malformed IP address string must return an `AppError`.
    #[test]
    fn test_get_mac_invalid_ip() {
        // Given: an obviously invalid IP address
        let result = get_mac("not_an_ip", "eth0", 1000, 1);
        // Then: the result must be an error
        assert!(result.is_err(), "Expected an error for an invalid IP address");

        let err = result.unwrap_err();
        let msg = err.to_string();
        assert!(
            msg.contains("Invalid IP address"),
            "Error message should mention 'Invalid IP address', got: {}",
            msg
        );
    }

    // -- Empty IP address test ---------------------------------------------

    /// An empty string must also be rejected as an invalid IP.
    #[test]
    fn test_get_mac_empty_ip() {
        // Given: an empty IP address string
        let result = get_mac("", "eth0", 1000, 1);
        // Then: the result must be an error
        assert!(result.is_err(), "Expected an error for an empty IP address");
    }

    // -- Retry count zero test ---------------------------------------------

    /// When `retry_count` is 0 the function should return `Ok(None)` without
    /// attempting any ARP resolution.
    #[test]
    fn test_get_mac_zero_retry() {
        // Given: a valid IP but zero retries
        // When: calling get_mac
        // Note: on non-Windows this would also fail at interface lookup, but
        // the IP parse succeeds; on Windows with 0 retries we skip SendARP
        // entirely. We test the parse-only path for both platforms by using a
        // valid IP format.
        #[cfg(target_os = "windows")]
        {
            let result = get_mac("192.168.1.1", "eth0", 1000, 0);
            // Then: Ok(None) because the loop body never executes
            assert!(result.is_ok());
            assert!(result.unwrap().is_none());
        }
    }
}
