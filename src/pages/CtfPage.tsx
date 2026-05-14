import React, { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { CTF_DETECTORS } from "../features/ctf/detectors";
import { DEFAULT_FLAG_PATTERNS } from "../features/ctf/flagPatterns";
import {
  appendCtfOperation,
  createCtfOperation,
  createCtfWorkspace,
  updateCtfWorkspaceNotes,
} from "../features/ctf/history";
import { CTF_HINT_SECTIONS } from "../features/ctf/hints";
import { CTF_TRANSFORMS } from "../features/ctf/transforms";
import { generateCtfWriteupMarkdown } from "../features/ctf/writeup";
import type { CtfOperationStatus } from "../features/ctf/types";

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
    [workspace],
  );

  const handleAddOperation = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const operation = createCtfOperation(operationForm);

    if (!operation.name) {
      setExportMessage("操作名を入力してください。");
      return;
    }

    setWorkspace((currentWorkspace) =>
      appendCtfOperation(currentWorkspace, operation),
    );
    setOperationForm(DEFAULT_OPERATION_FORM);
    setExportMessage(null);
  };

  const handleSaveMarkdown = async () => {
    setExportMessage(null);

    try {
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
    } catch (error) {
      setExportMessage(
        error instanceof Error
          ? error.message
          : "Markdownの書き出しに失敗しました。",
      );
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: "8px", fontSize: "20px" }}>
        CTF Reference
      </h2>
      <p style={descriptionStyle}>
        参照メモを見ながら、CTF Workspace の操作履歴とメモを記録できます。
      </p>

      <div style={workspaceGridStyle}>
        <section style={cardStyle} aria-labelledby="ctf-workspace-heading">
          <h3 id="ctf-workspace-heading" style={sectionHeadingStyle}>
            Workspace Memo
          </h3>
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
                updateCtfWorkspaceNotes(currentWorkspace, event.target.value),
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

        <section style={cardStyle} aria-labelledby="ctf-operation-heading">
          <h3 id="ctf-operation-heading" style={sectionHeadingStyle}>
            Operation Memo
          </h3>
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

      <section style={cardStyle} aria-labelledby="ctf-history-heading">
        <h3 id="ctf-history-heading" style={sectionHeadingStyle}>
          History
        </h3>
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
                <p style={historyTextStyle}>
                  Input: {operation.inputSummary || "未記録"}
                </p>
                <p style={historyTextStyle}>
                  Output: {operation.outputSummary || "未記録"}
                </p>
                <p style={historyTextStyle}>
                  Notes: {operation.notes || "未記録"}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section style={cardStyle} aria-labelledby="ctf-writeup-heading">
        <h3 id="ctf-writeup-heading" style={sectionHeadingStyle}>
          Writeup Preview
        </h3>
        <pre style={preStyle}>{markdownPreview}</pre>
      </section>

      <section aria-labelledby="ctf-hints-heading">
        <h3 id="ctf-hints-heading" style={groupHeadingStyle}>
          Hints
        </h3>
        {CTF_HINT_SECTIONS.map((section) => (
          <div key={section.title} style={cardStyle}>
            <h4 style={cardHeadingStyle}>{section.title}</h4>
            <ul style={listStyle}>
              {section.items.map((item) => (
                <li key={item} style={listItemStyle}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="ctf-transforms-heading" style={groupStyle}>
        <h3 id="ctf-transforms-heading" style={groupHeadingStyle}>
          Transforms
        </h3>
        <div style={referenceGridStyle}>
          {CTF_TRANSFORMS.map((transform) => (
            <article key={transform.id} style={cardStyle}>
              <h4 style={cardHeadingStyle}>{transform.label}</h4>
              <p style={referenceTextStyle}>{transform.description}</p>
              <p style={metadataStyle}>Category: {transform.category}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="ctf-detectors-heading" style={groupStyle}>
        <h3 id="ctf-detectors-heading" style={groupHeadingStyle}>
          Detectors
        </h3>
        <div style={referenceGridStyle}>
          {CTF_DETECTORS.map((detector) => (
            <article key={detector.id} style={cardStyle}>
              <h4 style={cardHeadingStyle}>{detector.label}</h4>
              <p style={metadataStyle}>ID: {detector.id}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="ctf-flag-patterns-heading" style={groupStyle}>
        <h3 id="ctf-flag-patterns-heading" style={groupHeadingStyle}>
          Flag Patterns
        </h3>
        <div style={referenceGridStyle}>
          {DEFAULT_FLAG_PATTERNS.map((pattern) => (
            <article key={pattern.id} style={cardStyle}>
              <h4 style={cardHeadingStyle}>{pattern.label}</h4>
              <p style={referenceTextStyle}>{pattern.description}</p>
              <p style={metadataStyle}>/{pattern.source}/{pattern.flags}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "16px",
  marginBottom: "12px",
};

const workspaceGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
};

const referenceGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const groupStyle: React.CSSProperties = {
  marginTop: "24px",
};

const groupHeadingStyle: React.CSSProperties = {
  fontSize: "16px",
  marginBottom: "12px",
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--accent)",
  marginBottom: "8px",
};

const cardHeadingStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--accent)",
  marginBottom: "8px",
};

const descriptionStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "13px",
  marginBottom: "20px",
};

const referenceTextStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "13px",
  margin: 0,
};

const metadataStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "12px",
  marginTop: "4px",
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

const listStyle: React.CSSProperties = {
  paddingLeft: "20px",
  fontSize: "13px",
  color: "var(--text-secondary)",
};

const listItemStyle: React.CSSProperties = {
  marginBottom: "4px",
};
