import React, { useMemo, useRef, useState } from "react";
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
import type { CtfOperationStatus, CtfTransform } from "../features/ctf/types";
import { generateCtfWriteupMarkdown } from "../features/ctf/writeup";

type CandidateKind = "flag" | "base64" | "hex" | "urlEncoded" | "printable";

type CtfCandidate = {
  kind: CandidateKind;
  value: string;
  note?: string;
};

type CtfAnalysis = Record<CandidateKind, CtfCandidate[]>;

type TransformResult = {
  name: string;
  output: string;
  flagCandidates: CtfCandidate[];
};

const DEFAULT_OPERATION_FORM = {
  name: "",
  inputSummary: "",
  outputSummary: "",
  status: "success" as CtfOperationStatus,
  notes: "",
};

const candidateGroups: readonly {
  kind: CandidateKind;
  title: string;
  emptyMessage: string;
}[] = [
  { kind: "flag", title: "flag形式候補", emptyMessage: "flag候補は未検出です。" },
  { kind: "base64", title: "Base64らしい文字列", emptyMessage: "Base64候補は未検出です。" },
  { kind: "hex", title: "Hexらしい文字列", emptyMessage: "Hex候補は未検出です。" },
  {
    kind: "urlEncoded",
    title: "URL encodeらしい文字列",
    emptyMessage: "URL encode候補は未検出です。",
  },
  {
    kind: "printable",
    title: "printable strings候補",
    emptyMessage: "printable strings候補は未検出です。",
  },
] as const;

const emptyAnalysis = (): CtfAnalysis => ({
  flag: [],
  base64: [],
  hex: [],
  urlEncoded: [],
  printable: [],
});

const uniqueCandidates = (items: CtfCandidate[]): CtfCandidate[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}:${item.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const summarizeText = (value: string, maxLength = 80): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "(empty)";
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}...`
    : normalized;
};

const analyzeCtfInput = (input: string): CtfAnalysis => {
  const analysis = emptyAnalysis();
  if (!input.trim()) return analysis;

  for (const detector of CTF_DETECTORS) {
    const detections = detector.detect(input, {});
    const candidates = detections.map((detection) => ({
      value: input.slice(detection.range.start, detection.range.end),
      note: detector.label,
    }));

    if (detector.id === "flag-pattern") {
      analysis.flag.push(...candidates.map((candidate) => ({ ...candidate, kind: "flag" as const })));
    } else if (detector.id === "base64-candidate") {
      analysis.base64.push(...candidates.map((candidate) => ({ ...candidate, kind: "base64" as const })));
    } else if (detector.id === "hex-candidate") {
      analysis.hex.push(...candidates.map((candidate) => ({ ...candidate, kind: "hex" as const })));
    } else if (detector.id === "url-encoded-candidate") {
      analysis.urlEncoded.push(
        ...candidates.map((candidate) => ({ ...candidate, kind: "urlEncoded" as const })),
      );
    }
  }

  analysis.printable = Array.from(input.matchAll(/[\x20-\x7e]{4,}/g), (match) => ({
    kind: "printable" as const,
    value: match[0],
    note: "4文字以上の表示可能ASCII",
  })).slice(0, 20);

  return {
    flag: uniqueCandidates(analysis.flag).slice(0, 20),
    base64: uniqueCandidates(analysis.base64).slice(0, 20),
    hex: uniqueCandidates(analysis.hex).slice(0, 20),
    urlEncoded: uniqueCandidates(analysis.urlEncoded).slice(0, 20),
    printable: uniqueCandidates(analysis.printable).slice(0, 20),
  };
};

const formatHistoryTime = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const findTransform = (id: string): CtfTransform | undefined =>
  CTF_TRANSFORMS.find((transform) => transform.id === id);

export const CtfPage: React.FC = () => {
  const [workspace, setWorkspace] = useState(() => createCtfWorkspace());
  const [operationForm, setOperationForm] = useState(DEFAULT_OPERATION_FORM);
  const [input, setInput] = useState("");
  const [selectedTransform, setSelectedTransform] = useState<string>(CTF_TRANSFORMS[0].id);
  const [result, setResult] = useState<TransformResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analysis = useMemo(() => analyzeCtfInput(input), [input]);
  const markdownPreview = useMemo(
    () => generateCtfWriteupMarkdown(workspace),
    [workspace],
  );
  const activeTransform = findTransform(selectedTransform);
  const canTransform = input.length > 0;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);
    setInput(await file.text());
  };

  const handleTransform = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canTransform || !activeTransform) {
      setResult(null);
      setError("変換する入力を貼り付けるか、ファイルを選択してください。");
      return;
    }

    try {
      const transformResult = activeTransform.run(input);
      const nextResult = {
        name: activeTransform.label,
        output: transformResult.output,
        flagCandidates: analyzeCtfInput(transformResult.output).flag,
      };
      const operation = createCtfOperation({
        name: activeTransform.label,
        inputSummary: summarizeText(input),
        outputSummary: summarizeText(transformResult.output),
        status: "success",
        notes: transformResult.notes?.join("\n") ?? "",
      });

      setResult(nextResult);
      setWorkspace((currentWorkspace) => appendCtfOperation(currentWorkspace, operation));
      setError(null);
      setExportMessage(null);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "変換に失敗しました。";
      const operation = createCtfOperation({
        name: activeTransform.label,
        inputSummary: summarizeText(input),
        outputSummary: message,
        status: "failure",
        notes: "",
      });

      setResult(null);
      setWorkspace((currentWorkspace) => appendCtfOperation(currentWorkspace, operation));
      setError(message);
    }
  };

  const handleAddOperation = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const operation = createCtfOperation(operationForm);

    if (!operation.name) {
      setExportMessage("操作名を入力してください。");
      return;
    }

    setWorkspace((currentWorkspace) => appendCtfOperation(currentWorkspace, operation));
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

      if (!selectedPath) return;

      await invoke("write_ctf_writeup", {
        filePath: selectedPath,
        markdown: markdownPreview,
      });
      setExportMessage(`Markdownを書き出しました: ${selectedPath}`);
    } catch (caughtError) {
      setExportMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Markdownの書き出しに失敗しました。",
      );
    }
  };

  const handleCopy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopyMessage(`${label}をコピーしました。`);
    window.setTimeout(() => setCopyMessage(null), 2000);
  };

  const handleClear = () => {
    setInput("");
    setFileName(null);
    setResult(null);
    setError(null);
    setCopyMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: "8px", fontSize: "20px" }}>CTF Workspace</h2>
      <p style={descriptionStyle}>
        貼り付けたテキストや選択したファイル内容を解析し、CTFで頻出する変換、flag候補抽出、writeup作成を行います。
      </p>

      <div style={{ display: "grid", gap: "16px" }}>
        <section style={cardStyle}>
          <h3 style={sectionHeadingStyle}>Workspace Memo</h3>
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
            rows={5}
            style={textareaStyle}
          />
          <button onClick={handleSaveMarkdown} style={buttonStyle} type="button">
            Markdown 書き出し
          </button>
          {exportMessage && <p style={messageStyle}>{exportMessage}</p>}
        </section>

        <section style={cardStyle}>
          <h3 style={sectionHeadingStyle}>入力エリア</h3>
          <label style={labelStyle} htmlFor="ctf-input">
            テキスト貼り付け
          </label>
          <textarea
            id="ctf-input"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setFileName(null);
            }}
            placeholder="flag{...}、Base64、Hex dump、URL encoded textなどを貼り付け"
            style={{
              ...textareaStyle,
              minHeight: "160px",
            }}
          />
          <div style={buttonRowStyle}>
            <button type="button" onClick={() => fileInputRef.current?.click()} style={secondaryButtonStyle}>
              ファイルを選択
            </button>
            <input ref={fileInputRef} type="file" onChange={handleFileChange} style={{ display: "none" }} />
            <button type="button" onClick={handleClear} style={dangerButtonStyle}>
              クリア
            </button>
            <span style={mutedStyle}>
              {fileName ? `選択中: ${fileName}` : "ファイル内容はテキストとして読み込みます。"}
            </span>
          </div>
        </section>

        <section style={cardStyle}>
          <h3 style={sectionHeadingStyle}>自動解析パネル</h3>
          <div style={referenceGridStyle}>
            {candidateGroups.map((group) => (
              <div key={group.kind}>
                <h4 style={cardHeadingStyle}>{group.title}</h4>
                {renderCandidateList(analysis[group.kind], group.emptyMessage)}
              </div>
            ))}
          </div>
        </section>

        <section style={cardStyle}>
          <h3 style={sectionHeadingStyle}>変換パネル</h3>
          <form onSubmit={handleTransform} style={{ display: "grid", gap: "12px" }}>
            <div>
              <label style={labelStyle} htmlFor="ctf-transform">
                変換
              </label>
              <select
                id="ctf-transform"
                value={selectedTransform}
                onChange={(event) => setSelectedTransform(event.target.value)}
                style={inputStyle}
              >
                {CTF_TRANSFORMS.map((transform) => (
                  <option key={transform.id} value={transform.id}>
                    {transform.label}
                  </option>
                ))}
              </select>
            </div>
            <p style={{ ...mutedStyle, margin: 0 }}>{activeTransform?.description}</p>
            <div style={buttonRowStyle}>
              <button type="submit" disabled={!canTransform} style={buttonStyle}>
                変換を実行
              </button>
              {result && (
                <button type="button" onClick={() => handleCopy(result.output, "変換結果")} style={secondaryButtonStyle}>
                  結果をコピー
                </button>
              )}
            </div>
          </form>
          {error && <p style={errorStyle}>{error}</p>}
        </section>

        <section style={cardStyle}>
          <h3 style={sectionHeadingStyle}>結果パネル</h3>
          {result ? (
            <div style={{ display: "grid", gap: "12px" }}>
              <div>
                <div style={{ ...mutedStyle, marginBottom: "6px" }}>変換結果: {result.name}</div>
                <pre style={preStyle}>{result.output}</pre>
              </div>
              <div>
                <div style={{ ...mutedStyle, marginBottom: "6px" }}>flag候補</div>
                {renderCandidateList(result.flagCandidates, "変換結果内にflag候補は未検出です。")}
              </div>
              <div style={buttonRowStyle}>
                <button type="button" onClick={() => handleCopy(result.output, "変換結果")} style={secondaryButtonStyle}>
                  変換結果をコピー
                </button>
                {result.flagCandidates.map((candidate, index) => (
                  <button
                    key={`${candidate.value}-${index}`}
                    type="button"
                    onClick={() => handleCopy(candidate.value, "flag候補")}
                    style={secondaryButtonStyle}
                  >
                    flag候補{index + 1}をコピー
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p style={mutedStyle}>変換を実行すると結果とflag候補が表示されます。</p>
          )}
          {copyMessage && <p style={accentMessageStyle}>{copyMessage}</p>}
        </section>

        <section style={cardStyle}>
          <h3 style={sectionHeadingStyle}>Operation Memo</h3>
          <form onSubmit={handleAddOperation}>
            <label style={labelStyle} htmlFor="ctf-operation-name">
              操作名
            </label>
            <input
              id="ctf-operation-name"
              value={operationForm.name}
              onChange={(event) =>
                setOperationForm((currentForm) => ({ ...currentForm, name: event.target.value }))
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
                setOperationForm((currentForm) => ({ ...currentForm, notes: event.target.value }))
              }
              rows={3}
              style={textareaStyle}
            />

            <button style={buttonStyle} type="submit">
              履歴に追加
            </button>
          </form>
        </section>

        <section style={cardStyle}>
          <h3 style={sectionHeadingStyle}>History</h3>
          {workspace.operations.length === 0 ? (
            <p style={mutedStyle}>まだ操作履歴はありません。</p>
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

        <section style={cardStyle}>
          <h3 style={sectionHeadingStyle}>Writeup Preview</h3>
          <pre style={preStyle}>{markdownPreview}</pre>
        </section>

        <section aria-labelledby="ctf-hints-heading">
          <h3 id="ctf-hints-heading" style={groupHeadingStyle}>
            Hints
          </h3>
          {CTF_HINT_SECTIONS.map((section) => (
            <article key={section.title} style={cardStyle}>
              <h4 style={cardHeadingStyle}>{section.title}</h4>
              <ul style={listStyle}>
                {section.items.map((item) => (
                  <li key={item} style={listItemStyle}>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section aria-labelledby="ctf-transforms-heading">
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

        <section aria-labelledby="ctf-detectors-heading">
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

        <section aria-labelledby="ctf-flag-patterns-heading">
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
    </div>
  );
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "16px",
};

const sectionHeadingStyle: React.CSSProperties = {
  color: "var(--accent)",
  fontSize: "14px",
  marginBottom: "10px",
};

const cardHeadingStyle: React.CSSProperties = {
  color: "var(--accent)",
  fontSize: "13px",
  marginBottom: "8px",
};

const groupHeadingStyle: React.CSSProperties = {
  fontSize: "16px",
  marginBottom: "12px",
};

const descriptionStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "13px",
  marginBottom: "20px",
};

const mutedStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "13px",
};

const referenceTextStyle: React.CSSProperties = {
  ...mutedStyle,
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

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: "var(--bg-tertiary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};

const dangerButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: "var(--error)",
  color: "#fff",
};

const buttonRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "12px",
};

const messageStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "12px",
  marginTop: "8px",
};

const accentMessageStyle: React.CSSProperties = {
  color: "var(--accent)",
  fontSize: "13px",
  marginTop: "10px",
};

const errorStyle: React.CSSProperties = {
  color: "var(--error)",
  fontSize: "13px",
  marginTop: "10px",
};

const referenceGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const preStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--text-primary)",
  fontSize: "12px",
  maxHeight: "300px",
  overflow: "auto",
  padding: "16px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};

const listStyle: React.CSSProperties = {
  paddingLeft: "20px",
  fontSize: "13px",
  color: "var(--text-secondary)",
};

const listItemStyle: React.CSSProperties = {
  marginBottom: "4px",
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

const renderCandidateList = (items: CtfCandidate[], emptyMessage: string) => {
  if (items.length === 0) {
    return <p style={mutedStyle}>{emptyMessage}</p>;
  }

  return (
    <ul style={{ display: "grid", gap: "6px", listStyle: "none", padding: 0, margin: 0 }}>
      {items.map((item, index) => (
        <li
          key={`${item.kind}-${item.value}-${index}`}
          style={{
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "8px",
          }}
        >
          <code style={{ color: "var(--text-primary)", fontSize: "12px", wordBreak: "break-all" }}>
            {item.value}
          </code>
          {item.note && <div style={{ ...mutedStyle, fontSize: "11px", marginTop: "4px" }}>{item.note}</div>}
        </li>
      ))}
    </ul>
  );
};
