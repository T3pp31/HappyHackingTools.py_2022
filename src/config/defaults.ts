export const LAN_SCAN_DEFAULTS = {
  startHost: "0",
  endHost: "255",
} as const;

export const PORT_SCAN_DEFAULTS = {
  targetIp: "127.0.0.1",
  portStart: "0",
  portEnd: "1024",
} as const;

export const ARP_SPOOF_DEFAULTS = {
  packetCount: "200",
} as const;
