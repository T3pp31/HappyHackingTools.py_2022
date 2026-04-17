import React, { useCallback, useMemo, useState } from "react";
import { useTauriCommand } from "../hooks/useTauriCommand";
import { useTauriEvent } from "../hooks/useTauriEvent";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { inputStyle, buttonStyle, labelStyle } from "../styles/formStyles";
import { PORT_SCAN_DEFAULTS } from "../config/defaults";
import type { PortScanResult, ScanProgress } from "../types";

interface PortFoundEvent {
  ip: string;
  port: number;
}

export const PortScanPage: React.FC = () => {
  const [ip, setIp] = useState(PORT_SCAN_DEFAULTS.targetIp);
  const [portStart, setPortStart] = useState(PORT_SCAN_DEFAULTS.portStart);
  const [portEnd, setPortEnd] = useState(PORT_SCAN_DEFAULTS.portEnd);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [openPorts, setOpenPorts] = useState<number[]>([]);
  const [scanTargetIp, setScanTargetIp] = useState("");
  const [scanRange, setScanRange] = useState<[number, number] | null>(null);
  const { data, loading, error, execute } =
    useTauriCommand<PortScanResult>("port_scan");

  const handleProgress = useCallback((nextProgress: ScanProgress) => {
    setProgress(nextProgress);
  }, []);

  const handlePortFound = useCallback((event: PortFoundEvent) => {
    setScanTargetIp(event.ip);
    setOpenPorts((previous) => {
      if (previous.includes(event.port)) {
        return previous;
      }
      return [...previous, event.port].sort((a, b) => a - b);
    });
  }, []);

  useTauriEvent<ScanProgress>("scan-progress", handleProgress);
  useTauriEvent<PortFoundEvent>("port-found", handlePortFound);

  const handleScan = async () => {
    setProgress(null);
    setOpenPorts([]);
    const startPort = Number(portStart);
    const endPort = Number(portEnd);
    const normalizedRange: [number, number] =
      startPort <= endPort ? [startPort, endPort] : [endPort, startPort];
    setScanTargetIp(ip);
    setScanRange(normalizedRange);

    const result = await execute({
      ip,
      port_start: startPort,
      port_end: endPort,
    });

    if (result) {
      setScanTargetIp(result.ip);
      setScanRange(result.scanned_range);
      setOpenPorts(result.open_ports);
    }
  };

  const resultIp = data?.ip ?? scanTargetIp;
  const resultRange = data?.scanned_range ?? scanRange;
  const resultOpenPorts = useMemo(
    () => (data ? data.open_ports : openPorts),
    [data, openPorts]
  );
  const hasResult = Boolean(resultIp && resultRange);

  return (
    <div>
      <h2 style={{ marginBottom: "8px", fontSize: "20px" }}>Port Scan</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>
        TCP connect scan to discover open ports.
      </p>

      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", alignItems: "end" }}>
        <div>
          <label style={labelStyle}>
            Target IP
          </label>
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            style={{ ...inputStyle, width: "160px" }}
          />
        </div>
        <div>
          <label style={labelStyle}>
            Port Start
          </label>
          <input
            type="number"
            min="0"
            max="65535"
            value={portStart}
            onChange={(e) => setPortStart(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>
            Port End
          </label>
          <input
            type="number"
            min="0"
            max="65535"
            value={portEnd}
            onChange={(e) => setPortEnd(e.target.value)}
            style={inputStyle}
          />
        </div>
        <button onClick={handleScan} disabled={loading} style={buttonStyle}>
          {loading ? "Scanning..." : "Scan"}
        </button>
      </div>

      {loading && (
        <>
          <LoadingSpinner message="Scanning ports..." />
          {progress && (
            <p style={{ marginTop: "-28px", marginBottom: "20px", color: "var(--text-secondary)", fontSize: "13px", textAlign: "center" }}>
              {progress.current} / {progress.total} - {progress.message}
            </p>
          )}
        </>
      )}
      {error && <ErrorMessage message={error} />}

      {hasResult && resultRange && (
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "12px", color: "var(--accent)" }}>
            Results: {resultIp} ({resultRange[0]}-{resultRange[1]})
          </h3>
          {resultOpenPorts.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>No open ports found.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {resultOpenPorts.map((port) => (
                <span
                  key={port}
                  style={{
                    padding: "4px 12px",
                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid var(--accent)",
                    borderRadius: "4px",
                    fontSize: "13px",
                    color: "var(--accent)",
                  }}
                >
                  {port}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
