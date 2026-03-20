import type React from "react";

export const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  backgroundColor: "var(--bg-tertiary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--text-primary)",
  fontSize: "13px",
  width: "100px",
  fontFamily: "inherit",
};

export const buttonStyle: React.CSSProperties = {
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

export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  color: "var(--text-secondary)",
  marginBottom: "4px",
};

export const dangerButtonStyle: React.CSSProperties = {
  padding: "8px 24px",
  backgroundColor: "var(--danger)",
  border: "none",
  borderRadius: "var(--radius)",
  color: "#fff",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};
