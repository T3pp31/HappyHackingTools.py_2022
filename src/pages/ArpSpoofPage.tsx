import React, { useState } from "react";
import { useArpSpoof } from "../hooks/useArpSpoof";
import { useNpcapCheck } from "../hooks/useNpcapCheck";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { NpcapDialog } from "../components/common/NpcapDialog";
import { inputStyle, buttonStyle, labelStyle, dangerButtonStyle } from "../styles/formStyles";
import { ARP_SPOOF_DEFAULTS } from "../config/defaults";

export const ArpSpoofPage: React.FC = () => {
  const [targetIp, setTargetIp] = useState("");
  const [gatewayIp, setGatewayIp] = useState("");
  const [packetCount, setPacketCount] = useState(ARP_SPOOF_DEFAULTS.packetCount);
  const { start, stop, startResult, stopResult, status } = useArpSpoof();
  const { showDialog, downloadUrl, checkAndExecute, closeDialog } =
    useNpcapCheck();

  const handleStart = () => {
    checkAndExecute(() => {
      start(targetIp, gatewayIp, Number(packetCount));
    });
  };

  const isLoading = startResult.loading || stopResult.loading;
  const error = startResult.error || stopResult.error;

  return (
    <div>
      <h2 style={{ marginBottom: "8px", fontSize: "20px" }}>ARP Spoofing</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>
        ARP poisoning to intercept network traffic. Captured packets are saved as pcap.
      </p>

      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", alignItems: "end" }}>
        <div>
          <label style={labelStyle}>Target IP</label>
          <input
            type="text"
            value={targetIp}
            onChange={(e) => setTargetIp(e.target.value)}
            placeholder="192.168.1.100"
            style={{ ...inputStyle, width: "160px" }}
          />
        </div>
        <div>
          <label style={labelStyle}>Gateway IP</label>
          <input
            type="text"
            value={gatewayIp}
            onChange={(e) => setGatewayIp(e.target.value)}
            placeholder="192.168.1.1"
            style={{ ...inputStyle, width: "160px" }}
          />
        </div>
        <div>
          <label style={labelStyle}>Packet Count</label>
          <input
            type="number"
            min="1"
            value={packetCount}
            onChange={(e) => setPacketCount(e.target.value)}
            style={inputStyle}
          />
        </div>
        <button onClick={handleStart} disabled={isLoading} style={buttonStyle}>
          Start
        </button>
        <button onClick={() => stop()} disabled={isLoading} style={dangerButtonStyle}>
          Stop
        </button>
      </div>

      {isLoading && <LoadingSpinner message="Processing..." />}
      {error && <ErrorMessage message={error} />}

      {status.data && (
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px" }}>
          <p style={{ fontSize: "13px" }}>
            Status: {status.data.is_running ? "Running" : "Stopped"}
          </p>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Packets captured: {status.data.packets_captured}
          </p>
          {status.data.pcap_path && (
            <p style={{ fontSize: "13px", color: "var(--accent)" }}>
              Saved to: {status.data.pcap_path}
            </p>
          )}
          {status.data.last_error && (
            <p style={{ fontSize: "13px", color: "var(--danger)" }}>
              Last error: {status.data.last_error}
            </p>
          )}
        </div>
      )}
      <NpcapDialog
        visible={showDialog}
        downloadUrl={downloadUrl}
        onClose={closeDialog}
      />
    </div>
  );
};
