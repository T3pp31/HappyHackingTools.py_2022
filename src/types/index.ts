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

export interface WebHeaderCheck {
  name: string;
  present: boolean;
  severity: string;
  message: string;
}

export interface WebCorsCheck {
  name: string;
  value: string | null;
  severity: string;
  message: string;
}

export interface WebCookieCheck {
  name: string;
  secure: boolean;
  http_only: boolean;
  same_site: boolean;
  same_site_value?: string | null;
  prefix_valid?: boolean;
  severity: string;
  message: string;
}

export interface WebCheckFinding {
  severity: string;
  message: string;
}

export interface WebPathCheck {
  path: string;
  url: string;
  status_code: number | null;
  content_type: string | null;
  cache_control: string | null;
  severity: string;
  message: string;
}

export interface WebInputCheck {
  name: string;
  method: string;
  url: string;
  parameter: string;
  reflected: boolean;
  status_code: number | null;
  error_signature: string | null;
  external_redirect: boolean;
  severity: string;
  message: string;
}

export interface WebFormCandidate {
  action: string;
  method: string;
  inputs: string[];
}

export interface WebCheckResult {
  target_url: string;
  final_url: string;
  status_code: number | null;
  response_time_ms: number;
  redirected: boolean;
  uses_https: boolean;
  tls_valid: boolean | null;
  tls_error: string | null;
  content_type: string | null;
  server_header: string | null;
  security_headers: WebHeaderCheck[];
  cors_checks: WebCorsCheck[];
  cookie_checks: WebCookieCheck[];
  allowed_methods: string[];
  path_checks: WebPathCheck[];
  input_checks: WebInputCheck[];
  form_candidates: WebFormCandidate[];
  findings: WebCheckFinding[];
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
  magic_bytes: string;
  file_type_guess: string;
  sha256: string;
  sha1: string;
  md5: string;
  printable_strings: string[];
  flag_candidates: string[];
  entropy: number;
  warnings: string[];
}

export interface ScanProgress {
  current: number;
  total: number;
  message: string;
}
