import { useTauriCommand } from "./useTauriCommand";
import type { ArpSpoofStatus } from "../types";

export function useArpSpoof() {
  const startCmd = useTauriCommand<string>("start_arp_spoof");
  const stopCmd = useTauriCommand<ArpSpoofStatus>("stop_arp_spoof");
  const statusCmd = useTauriCommand<ArpSpoofStatus>("get_arp_spoof_status");

  const start = async (
    targetIp: string,
    gatewayIp: string,
    packetCount: number
  ) => {
    return startCmd.execute({
      target_ip: targetIp,
      gateway_ip: gatewayIp,
      packet_count: packetCount,
    });
  };

  const stop = async () => {
    return stopCmd.execute();
  };

  const getStatus = async () => {
    return statusCmd.execute();
  };

  return {
    start,
    stop,
    getStatus,
    startResult: startCmd,
    stopResult: stopCmd,
    status: statusCmd,
  };
}
