import React, { useState } from "react";
import { useTauriCommand } from "../hooks/useTauriCommand";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { ErrorMessage } from "../components/common/ErrorMessage";
import type { PortScanResult } from "../types";

export const PortScanPage: React.FC = () => {
  const [ip, setIp] = useState("127.0.0.1");
  const [portStart, setPortStart] = useState("0");
  const [portEnd, setPortEnd] = useState("1024");
  const { data, loading, error, execute } =
    useTauriCommand<PortScanResult>("port_scan");

  const handleScan = () => {
    execute({
      ip,
      port_start: Number(portStart),
      port_end: Number(portEnd),
    });
  };

  return (
    <div>
      <h2 style={{ marginBottom: "8px", fontSize: "20px" }}>Port Scan</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>
        TCP connect scan to discover open ports.
      </p>

      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", alignItems: "end" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>
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
          <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>
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
          <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>
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

      {loading && <LoadingSpinner message="Scanning ports..." />}
      {error && <ErrorMessage message={error} />}

      {data && (
        <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "12px", color: "var(--accent)" }}>
            Results: {data.ip} ({data.scanned_range[0]}-{data.scanned_range[1]})
          </h3>
          {data.open_ports.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>No open ports found.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {data.open_ports.map((port) => (
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

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  backgroundColor: "var(--bg-tertiary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--text-primary)",
  fontSize: "13px",
  width: "100px",
  fontFamily: "inherit",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 24px",
  backgroundColor: "var(--accent)",
  border: "none",
  borderRadius: "var(--radius)",
  color: "#000",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};
