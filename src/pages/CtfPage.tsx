import React, { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import {
  appendCtfOperation,
  createCtfOperation,
  createCtfWorkspace,
  updateCtfWorkspaceNotes,
} from "../features/ctf/history";
import { generateCtfWriteupMarkdown } from "../features/ctf/writeup";
import type { CtfOperationStatus } from "../features/ctf/types";

const SECTIONS = [
  {
    title: "Forensics",
    items: [
      "Log analysis: grep, grep -v (exclude), uniq (deduplicate), sort",
    ],
  },
  {
    title: "Web",
    items: ["Burpsuite"],
  },
  {
    title: "Network",
    items: ["Wireshark", "Scapy", "socket", "Port scan: nmap"],
  },
  {
    title: "Binary",
    items: [
      "Binary editor: Hex Fiend",
      "file: identify binary file type",
      "less: view file contents",
      "strings: extract readable strings",
    ],
  },
  {
    title: "Encoding",
    items: [
      "Base64: A-Z, a-z, 0-9, +, / (64 chars), ends with =",
      'Decode: echo "encoded_string" | base64 -d -o output',
    ],
  },
  {
    title: "File Location",
    items: [
      "locate: find file location",
      "VS Code SSH: browse files via GUI",
    ],
  },
] as const;

const DEFAULT_OPERATION_FORM = {
  name: "",
  inputSummary: "",
  outputSummary: "",
  status: "success" as CtfOperationStatus,
  notes: "",
};

const formatHistoryTime = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const CtfPage: React.FC = () => {
  const [workspace, setWorkspace] = useState(() => createCtfWorkspace());
  const [operationForm, setOperationForm] = useState(DEFAULT_OPERATION_FORM);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const markdownPreview = useMemo(
    () => generateCtfWriteupMarkdown(workspace),
    [workspace]
  );

  const handleAddOperation = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const operation = createCtfOperation(operationForm);

    if (!operation.name) {
      setExportMessage("操作名を入力してください。");
      return;
    }

    setWorkspace((currentWorkspace) =>
      appendCtfOperation(currentWorkspace, operation)
    );
    setOperationForm(DEFAULT_OPERATION_FORM);
    setExportMessage(null);
  };

  const handleSaveMarkdown = async () => {
    setExportMessage(null);
    const selectedPath = await save({
      defaultPath: `${workspace.challengeName || "ctf-writeup"}.md`,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });

    if (!selectedPath) {
      return;
    }

    await invoke("write_ctf_writeup", {
      filePath: selectedPath,
      markdown: markdownPreview,
    });
    setExportMessage(`Markdownを書き出しました: ${selectedPath}`);
  };

  return (
    <div>
      <h2 style={{ marginBottom: "8px", fontSize: "20px" }}>
        CTF Reference
      </h2>
      <p style={descriptionStyle}>
        参照メモを見ながら、CTF Workspace の操作履歴とメモを記録できます。
      </p>

      <div style={gridStyle}>
        <section style={sectionStyle}>
          <h3 style={headingStyle}>Workspace Memo</h3>
          <label style={labelStyle} htmlFor="ctf-challenge-name">
            Challenge
          </label>
          <input
            id="ctf-challenge-name"
            value={workspace.challengeName}
            onChange={(event) =>
              setWorkspace((currentWorkspace) => ({
                ...currentWorkspace,
                challengeName: event.target.value,
                updatedAt: new Date().toISOString(),
              }))
            }
            style={inputStyle}
          />
          <label style={labelStyle} htmlFor="ctf-workspace-notes">
            Notes
          </label>
          <textarea
            id="ctf-workspace-notes"
            value={workspace.notes}
            onChange={(event) =>
              setWorkspace((currentWorkspace) =>
                updateCtfWorkspaceNotes(currentWorkspace, event.target.value)
              )
            }
            placeholder="調査方針、詰まっている点、あとで確認することを記録"
            rows={6}
            style={textareaStyle}
          />
          <button onClick={handleSaveMarkdown} style={buttonStyle} type="button">
            Markdown 書き出し
          </button>
          {exportMessage && <p style={messageStyle}>{exportMessage}</p>}
        </section>

        <section style={sectionStyle}>
          <h3 style={headingStyle}>Operation Memo</h3>
          <form onSubmit={handleAddOperation}>
            <label style={labelStyle} htmlFor="ctf-operation-name">
              操作名
            </label>
            <input
              id="ctf-operation-name"
              value={operationForm.name}
              onChange={(event) =>
                setOperationForm((currentForm) => ({
                  ...currentForm,
                  name: event.target.value,
                }))
              }
              placeholder="例: strings challenge.bin"
              style={inputStyle}
            />

            <label style={labelStyle} htmlFor="ctf-operation-input">
              入力概要
            </label>
            <textarea
              id="ctf-operation-input"
              value={operationForm.inputSummary}
              onChange={(event) =>
                setOperationForm((currentForm) => ({
                  ...currentForm,
                  inputSummary: event.target.value,
                }))
              }
              rows={2}
              style={textareaStyle}
            />

            <label style={labelStyle} htmlFor="ctf-operation-output">
              出力概要
            </label>
            <textarea
              id="ctf-operation-output"
              value={operationForm.outputSummary}
              onChange={(event) =>
                setOperationForm((currentForm) => ({
                  ...currentForm,
                  outputSummary: event.target.value,
                }))
              }
              rows={2}
              style={textareaStyle}
            />

            <label style={labelStyle} htmlFor="ctf-operation-status">
              成功/失敗
            </label>
            <select
              id="ctf-operation-status"
              value={operationForm.status}
              onChange={(event) =>
                setOperationForm((currentForm) => ({
                  ...currentForm,
                  status: event.target.value as CtfOperationStatus,
                }))
              }
              style={inputStyle}
            >
              <option value="success">成功</option>
              <option value="failure">失敗</option>
            </select>

            <label style={labelStyle} htmlFor="ctf-operation-notes">
              メモ
            </label>
            <textarea
              id="ctf-operation-notes"
              value={operationForm.notes}
              onChange={(event) =>
                setOperationForm((currentForm) => ({
                  ...currentForm,
                  notes: event.target.value,
                }))
              }
              rows={3}
              style={textareaStyle}
            />

            <button style={buttonStyle} type="submit">
              履歴に追加
            </button>
          </form>
        </section>
      </div>

      <section style={sectionStyle}>
        <h3 style={headingStyle}>History</h3>
        {workspace.operations.length === 0 ? (
          <p style={descriptionStyle}>まだ操作履歴はありません。</p>
        ) : (
          <ol style={historyListStyle}>
            {workspace.operations.map((operation) => (
              <li key={operation.id} style={historyItemStyle}>
                <div style={historyHeaderStyle}>
                  <strong>{operation.name}</strong>
                  <span>{formatHistoryTime(operation.executedAt)}</span>
                </div>
                <span style={statusStyle(operation.status)}>
                  {operation.status === "success" ? "成功" : "失敗"}
                </span>
                <p style={historyTextStyle}>Input: {operation.inputSummary || "未記録"}</p>
                <p style={historyTextStyle}>Output: {operation.outputSummary || "未記録"}</p>
                <p style={historyTextStyle}>Notes: {operation.notes || "未記録"}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section style={sectionStyle}>
        <h3 style={headingStyle}>Writeup Preview</h3>
        <pre style={preStyle}>{markdownPreview}</pre>
      </section>

      {SECTIONS.map((section) => (
        <section key={section.title} style={sectionStyle}>
          <h3 style={headingStyle}>{section.title}</h3>
          <ul style={{ paddingLeft: "20px", fontSize: "13px", color: "var(--text-secondary)" }}>
            {section.items.map((item) => (
              <li key={item} style={{ marginBottom: "4px" }}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
};

const sectionStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "16px",
  marginBottom: "12px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--accent)",
  marginBottom: "8px",
};

const descriptionStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "13px",
  marginBottom: "20px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  color: "var(--text-secondary)",
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  backgroundColor: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--text-primary)",
  fontFamily: "inherit",
  fontSize: "13px",
  marginBottom: "12px",
  padding: "8px",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical",
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

const messageStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "12px",
  marginTop: "8px",
};

const historyListStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const historyItemStyle: React.CSSProperties = {
  borderTop: "1px solid var(--border)",
  padding: "12px 0",
};

const historyHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  fontSize: "13px",
  justifyContent: "space-between",
  gap: "12px",
};

const historyTextStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "12px",
  margin: "4px 0 0",
  whiteSpace: "pre-wrap",
};

const statusStyle = (status: CtfOperationStatus): React.CSSProperties => ({
  color: status === "success" ? "var(--success)" : "var(--error)",
  display: "inline-block",
  fontSize: "12px",
  marginTop: "6px",
});

const preStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "16px",
  fontSize: "12px",
  overflow: "auto",
  maxHeight: "300px",
  whiteSpace: "pre-wrap",
};
