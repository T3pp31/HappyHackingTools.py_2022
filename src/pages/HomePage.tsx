import React from "react";
import { useNetworkInfo } from "../hooks/useNetworkInfo";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { ErrorMessage } from "../components/common/ErrorMessage";

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "20px",
  marginBottom: "16px",
};

const labelStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "12px",
  marginBottom: "4px",
};

const valueStyle: React.CSSProperties = {
  color: "var(--accent)",
  fontSize: "16px",
  fontWeight: 600,
};

export const HomePage: React.FC = () => {
  const { networkInfo, loading, error } = useNetworkInfo();

  return (
    <div>
      <h2 style={{ marginBottom: "20px", fontSize: "20px" }}>
        Network Information
      </h2>

      {loading && <LoadingSpinner message="Fetching network info..." />}
      {error && <ErrorMessage message={error} />}

      {networkInfo && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={cardStyle}>
            <div style={labelStyle}>IP Address</div>
            <div style={valueStyle}>{networkInfo.ip_address}</div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>Broadcast Address</div>
            <div style={valueStyle}>{networkInfo.broadcast_address}</div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>Interface</div>
            <div style={valueStyle}>{networkInfo.interface_name}</div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>Subnet Mask</div>
            <div style={valueStyle}>{networkInfo.subnet_mask}</div>
          </div>
          {networkInfo.gateway && (
            <div style={cardStyle}>
              <div style={labelStyle}>Gateway</div>
              <div style={valueStyle}>{networkInfo.gateway}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
