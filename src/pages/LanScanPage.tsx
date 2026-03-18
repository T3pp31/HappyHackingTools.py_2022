import React, { useState } from "react";
import { useTauriCommand } from "../hooks/useTauriCommand";
import { DataTable } from "../components/common/DataTable";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { ErrorMessage } from "../components/common/ErrorMessage";
import type { DeviceInfo } from "../types";

const COLUMNS = [
  { key: "ip" as const, label: "IP Address" },
  { key: "mac" as const, label: "MAC Address" },
  { key: "hostname" as const, label: "Hostname" },
  { key: "vendor_name" as const, label: "Vendor" },
];

export const LanScanPage: React.FC = () => {
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState("255");
  const { data, loading, error, execute } =
    useTauriCommand<DeviceInfo[]>("lan_scan");

  const handleScan = () => {
    execute({ start: Number(start), end: Number(end) });
  };

  return (
    <div>
      <h2 style={{ marginBottom: "8px", fontSize: "20px" }}>LAN Scan</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>
        ARP request to discover devices on the local network.
      </p>

      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", alignItems: "end" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>
            Start
          </label>
          <input
            type="number"
            min="0"
            max="255"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>
            End
          </label>
          <input
            type="number"
            min="0"
            max="255"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            style={inputStyle}
          />
        </div>
        <button onClick={handleScan} disabled={loading} style={buttonStyle}>
          {loading ? "Scanning..." : "Scan"}
        </button>
      </div>

      {loading && <LoadingSpinner message="Scanning network..." />}
      {error && <ErrorMessage message={error} />}
      {data && <DataTable columns={COLUMNS} data={data} />}
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
