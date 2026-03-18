import React from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useTauriCommand } from "../hooks/useTauriCommand";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { ErrorMessage } from "../components/common/ErrorMessage";
import type { BinaryContent } from "../types";

export const BinaryPage: React.FC = () => {
  const { data, loading, error, execute } =
    useTauriCommand<BinaryContent>("read_binary_file");

  const handleSelectFile = async () => {
    const selected = await open({ multiple: false });
    if (selected) {
      execute({ file_path: selected as string });
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: "8px", fontSize: "20px" }}>Binary Analysis</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>
        View hex dump and decoded text of any file.
      </p>

      <button onClick={handleSelectFile} disabled={loading} style={buttonStyle}>
        Select File
      </button>

      {loading && <LoadingSpinner message="Reading file..." />}
      {error && <ErrorMessage message={error} />}

      {data && (
        <div style={{ marginTop: "20px" }}>
          <div style={{ marginBottom: "8px", fontSize: "13px", color: "var(--text-secondary)" }}>
            {data.file_name} ({data.file_size} bytes)
          </div>

          <h3 style={{ fontSize: "14px", color: "var(--accent)", marginBottom: "8px" }}>
            Hex Dump
          </h3>
          <pre style={preStyle}>{data.hex_dump}</pre>

          <h3 style={{ fontSize: "14px", color: "var(--accent)", margin: "16px 0 8px" }}>
            Decoded Text
          </h3>
          <pre style={preStyle}>{data.decoded_text}</pre>
        </div>
      )}
    </div>
  );
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

const preStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "16px",
  fontSize: "12px",
  overflow: "auto",
  maxHeight: "300px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};
