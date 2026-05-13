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
      <h2 style={{ marginBottom: "8px", fontSize: "20px" }}>Binary Analysis</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>
        View CTF-oriented summary, hashes, strings, flags, hex dump, and decoded text of any file.
      </p>

      <button onClick={handleSelectFile} disabled={loading} style={buttonStyle}>
        Select File
      </button>

      {loading && <LoadingSpinner message="Reading file..." />}
      {error && <ErrorMessage message={error} />}

      {data && (
        <div style={{ marginTop: "20px" }}>
          <Section title="Summary">
            <dl style={definitionListStyle}>
              <dt>File Name</dt>
              <dd>{data.file_name}</dd>
              <dt>File Size</dt>
              <dd>{data.file_size} bytes</dd>
              <dt>File Type Guess</dt>
              <dd>{data.file_type_guess}</dd>
              <dt>Entropy</dt>
              <dd>{data.entropy.toFixed(4)} bits/byte</dd>
            </dl>
          </Section>

          <Section title="Hashes">
            <dl style={definitionListStyle}>
              <dt>SHA-256</dt>
              <dd style={hashValueStyle}>{data.sha256}</dd>
              <dt>SHA-1</dt>
              <dd style={hashValueStyle}>{data.sha1}</dd>
              <dt>MD5</dt>
              <dd style={hashValueStyle}>{data.md5}</dd>
            </dl>
          </Section>

          <Section title="Magic Bytes">
            <pre style={preStyle}>{data.magic_bytes || "(none)"}</pre>
          </Section>

          <Section title="Strings">
            <StringList values={data.printable_strings} emptyMessage="No printable strings found." />
          </Section>

          <Section title="Flag Candidates">
            <StringList values={data.flag_candidates} emptyMessage="No flag candidates found." />
          </Section>

          <Section title="Warnings">
            <StringList values={data.warnings} emptyMessage="No warnings." />
          </Section>

          <Section title="Hex Dump">
            <pre style={preStyle}>{data.hex_dump}</pre>
          </Section>

          <Section title="Decoded Text">
            <pre style={preStyle}>{data.decoded_text}</pre>
          </Section>
        </div>
      )}
    </div>
  );
};

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <section style={{ marginTop: "16px" }}>
    <h3 style={{ fontSize: "14px", color: "var(--accent)", marginBottom: "8px" }}>
      {title}
    </h3>
    {children}
  </section>
);

interface StringListProps {
  values: string[];
  emptyMessage: string;
}

const StringList: React.FC<StringListProps> = ({ values, emptyMessage }) => {
  if (values.length === 0) {
    return <div style={emptyStyle}>{emptyMessage}</div>;
  }

  return (
    <ul style={listStyle}>
      {values.map((value, index) => (
        <li key={`${value}-${index}`}>
          <code>{value}</code>
        </li>
      ))}
    </ul>
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

const definitionListStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "140px minmax(0, 1fr)",
  gap: "8px 12px",
  margin: 0,
  fontSize: "13px",
};

const hashValueStyle: React.CSSProperties = {
  wordBreak: "break-all",
  fontFamily: "monospace",
};

const listStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  margin: 0,
  maxHeight: "220px",
  overflow: "auto",
  padding: "12px 16px 12px 32px",
  fontSize: "12px",
};

const emptyStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "13px",
};
