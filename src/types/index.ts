export interface NetworkInfo {
  ip_address: string;
  broadcast_address: string;
  interface_name: string;
  subnet_mask: string;
  gateway: string | null;
}

export interface DeviceInfo {
  ip: string;
  mac: string | null;
  hostname: string | null;
  vendor_name: string | null;
}

export interface PortScanResult {
  ip: string;
  open_ports: number[];
  scanned_range: [number, number];
}

export interface ArpSpoofStatus {
  is_running: boolean;
  packets_captured: number;
  pcap_path: string | null;
  last_error: string | null;
}

export interface BinaryContent {
  hex_dump: string;
  decoded_text: string;
  file_size: number;
  file_name: string;
}

export interface ScanProgress {
  current: number;
  total: number;
  message: string;
}
