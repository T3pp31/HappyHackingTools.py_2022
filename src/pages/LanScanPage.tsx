import React, { useState } from "react";
import { useTauriCommand } from "../hooks/useTauriCommand";
import { DataTable } from "../components/common/DataTable";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { inputStyle, buttonStyle, labelStyle } from "../styles/formStyles";
import { LAN_SCAN_DEFAULTS } from "../config/defaults";
import type { DeviceInfo } from "../types";

const COLUMNS = [
  { key: "ip" as const, label: "IP Address" },
  { key: "mac" as const, label: "MAC Address" },
  { key: "hostname" as const, label: "Hostname" },
  { key: "vendor_name" as const, label: "Vendor" },
];

export const LanScanPage: React.FC = () => {
  const [start, setStart] = useState(LAN_SCAN_DEFAULTS.startHost);
  const [end, setEnd] = useState(LAN_SCAN_DEFAULTS.endHost);
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
          <label style={labelStyle}>
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
          <label style={labelStyle}>
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
