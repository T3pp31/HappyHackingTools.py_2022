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
      execute({ filePath: selected as string });
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: "8px", fontSize: "20px" }}>CTF Artifact Analyzer</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>
        ファイルのmagic bytes、hash、printable strings、flag候補、hex dumpをローカルで確認します。
      </p>

      <button onClick={handleSelectFile} disabled={loading} style={buttonStyle}>
        Select File
      </button>

      {loading && <LoadingSpinner message="Reading file..." />}
      {error && <ErrorMessage message={error} />}

      {data && (
        <div style={{ marginTop: "20px", display: "grid", gap: "16px" }}>
          <section style={cardStyle}>
            <h3 style={headingStyle}>Summary</h3>
            <div style={summaryGridStyle}>
              <SummaryItem label="File" value={data.file_name} />
              <SummaryItem label="Size" value={`${data.file_size} bytes`} />
              <SummaryItem label="Type" value={data.file_type_guess} />
              <SummaryItem label="Entropy" value={data.entropy.toFixed(3)} />
              <SummaryItem label="Magic bytes" value={data.magic_bytes || "なし"} />
            </div>
            {data.warnings.length > 0 && (
              <ul style={{ marginTop: "12px", color: "#f7d774", fontSize: "13px" }}>
                {data.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            )}
          </section>

          <section style={cardStyle}>
            <h3 style={headingStyle}>Hashes</h3>
            <pre style={preStyle}>{`SHA256 ${data.sha256}`}</pre>
          </section>

          <section style={cardStyle}>
            <h3 style={headingStyle}>Flag Candidates</h3>
            {data.flag_candidates.length === 0 ? (
              <p style={mutedStyle}>flag候補は見つかりませんでした。</p>
            ) : (
              <ul style={{ paddingLeft: "20px", fontSize: "13px" }}>
                {data.flag_candidates.map((candidate) => <li key={candidate}><code>{candidate}</code></li>)}
              </ul>
            )}
          </section>

          <section style={cardStyle}>
            <h3 style={headingStyle}>Printable Strings</h3>
            <pre style={preStyle}>{data.printable_strings.join("\n") || "なし"}</pre>
          </section>

          <section style={cardStyle}>
            <h3 style={headingStyle}>Hex Dump</h3>
            <pre style={preStyle}>{data.hex_dump}</pre>
          </section>

          <section style={cardStyle}>
            <h3 style={headingStyle}>Decoded Text Preview</h3>
            <pre style={preStyle}>{data.decoded_text}</pre>
          </section>
        </div>
      )}
    </div>
  );
};

const SummaryItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={mutedStyle}>{label}</div>
    <div style={{ color: "var(--text-primary)", fontSize: "13px", wordBreak: "break-all" }}>{value}</div>
  </div>
);

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

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "16px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--accent)",
  marginBottom: "8px",
};

const mutedStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "12px",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
};

const preStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "16px",
  fontSize: "12px",
  overflow: "auto",
  maxHeight: "300px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};
