import React, { useMemo, useState } from "react";
import { collectFlagCandidates } from "../features/ctf/flagPatterns";
import { detectCtfArtifacts } from "../features/ctf/detectors";
import { CTF_TRANSFORMS } from "../features/ctf/transforms";
import { createOperation } from "../features/ctf/history";
import { generateWriteupMarkdown } from "../features/ctf/writeup";
import type { CtfOperation, CtfTransformResult } from "../features/ctf/types";

const sectionStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "16px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
  gap: "16px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "220px",
  backgroundColor: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--text-primary)",
  fontFamily: "inherit",
  fontSize: "13px",
  padding: "12px",
  resize: "vertical",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 14px",
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
  backgroundColor: "transparent",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
};

const preStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "12px",
  fontSize: "12px",
  overflow: "auto",
  maxHeight: "260px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};

const smallTextStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "12px",
};

export const CtfPage: React.FC = () => {
  const [challengeName, setChallengeName] = useState("example-challenge");
  const [sourceText, setSourceText] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTransformId, setSelectedTransformId] = useState(CTF_TRANSFORMS[0]?.id ?? "");
  const [results, setResults] = useState<CtfTransformResult[]>([]);
  const [operations, setOperations] = useState<CtfOperation[]>([]);

  const selectedTransform = CTF_TRANSFORMS.find((transform) => transform.id === selectedTransformId);
  const detections = useMemo(() => detectCtfArtifacts(sourceText), [sourceText]);
  const flagCandidates = useMemo(() => {
    const fromSource = collectFlagCandidates(sourceText);
    const fromOperations = operations.flatMap((operation) => collectFlagCandidates(operation.output));
    const seen = new Set<string>();
    return [...fromSource, ...fromOperations].filter((candidate) => {
      const key = `${candidate.patternId}:${candidate.value}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [operations, sourceText]);

  const runTransform = () => {
    if (!selectedTransform) {
      return;
    }
    const transformResults = selectedTransform.run(sourceText);
    setResults(transformResults);
    setOperations((current) => [
      ...transformResults.map((result) => createOperation(selectedTransform, result, sourceText)),
      ...current,
    ]);
  };

  const applyResultAsInput = (output: string) => {
    setSourceText(output);
  };

  const writeupMarkdown = useMemo(
    () => generateWriteupMarkdown({ challengeName, sourceText, notes, operations: [...operations].reverse(), flagCandidates }),
    [challengeName, flagCandidates, notes, operations, sourceText]
  );

  const downloadWriteup = () => {
    const blob = new Blob([writeupMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${challengeName.trim() || "ctf-writeup"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2 style={{ marginBottom: "8px", fontSize: "20px" }}>CTF Solver Workbench</h2>
      <p style={{ ...smallTextStyle, marginBottom: "20px" }}>
        問題ファイル由来の文字列や怪しい値を入れて、観察・変換・flag候補抽出・writeup作成まで進めるローカル作業机です。
      </p>

      <div style={gridStyle}>
        <section style={sectionStyle}>
          <h3 style={{ fontSize: "14px", color: "var(--accent)", marginBottom: "12px" }}>入力</h3>
          <label style={smallTextStyle} htmlFor="challenge-name">Challenge name</label>
          <input
            id="challenge-name"
            value={challengeName}
            onChange={(event) => setChallengeName(event.target.value)}
            style={{ ...inputStyle, minHeight: "auto", margin: "6px 0 12px" }}
          />
          <textarea
            aria-label="CTF input"
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            placeholder="flag{...} / Base64 / Hex / URL encoded text / strings結果などを貼り付け"
            style={inputStyle}
          />
        </section>

        <section style={sectionStyle}>
          <h3 style={{ fontSize: "14px", color: "var(--accent)", marginBottom: "12px" }}>自動解析</h3>
          <div style={{ display: "grid", gap: "8px" }}>
            {detections.length === 0 && <p style={smallTextStyle}>入力するとflag候補・Base64・Hex・URL encode・hashらしい値を検出します。</p>}
            {detections.map((detection) => (
              <div key={detection.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                <strong style={{ fontSize: "13px" }}>{detection.label}</strong>
                <div style={{ ...smallTextStyle, margin: "4px 0" }}>{detection.recommendation}</div>
                <code style={{ fontSize: "12px", wordBreak: "break-all" }}>{detection.value}</code>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div style={{ ...gridStyle, marginTop: "16px" }}>
        <section style={sectionStyle}>
          <h3 style={{ fontSize: "14px", color: "var(--accent)", marginBottom: "12px" }}>試す</h3>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
            <select
              aria-label="CTF transform"
              value={selectedTransformId}
              onChange={(event) => setSelectedTransformId(event.target.value)}
              style={{ ...inputStyle, minHeight: "auto", flex: "1 1 260px" }}
            >
              {CTF_TRANSFORMS.map((transform) => (
                <option key={transform.id} value={transform.id}>{transform.label}</option>
              ))}
            </select>
            <button type="button" onClick={runTransform} style={buttonStyle}>Run</button>
          </div>
          {selectedTransform && <p style={{ ...smallTextStyle, marginBottom: "12px" }}>{selectedTransform.description}</p>}
          {results.map((result) => (
            <div key={`${result.label}:${result.output}`} style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                <strong style={{ fontSize: "13px" }}>{result.label}</strong>
                <button type="button" onClick={() => applyResultAsInput(result.output)} style={secondaryButtonStyle}>入力へ戻す</button>
              </div>
              {result.note && <div style={smallTextStyle}>{result.note}</div>}
              <pre style={preStyle}>{result.output}</pre>
            </div>
          ))}
        </section>

        <section style={sectionStyle}>
          <h3 style={{ fontSize: "14px", color: "var(--accent)", marginBottom: "12px" }}>記録 / flag候補</h3>
          <textarea
            aria-label="CTF notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="観察・仮説・詰まった点をメモ"
            style={{ ...inputStyle, minHeight: "90px", marginBottom: "12px" }}
          />
          <h4 style={{ fontSize: "13px", marginBottom: "8px" }}>Flag Candidates</h4>
          {flagCandidates.length === 0 ? (
            <p style={smallTextStyle}>まだflag候補はありません。</p>
          ) : (
            <ul style={{ paddingLeft: "18px", fontSize: "13px" }}>
              {flagCandidates.map((candidate) => (
                <li key={`${candidate.patternId}:${candidate.value}`}>
                  <code>{candidate.value}</code> <span style={smallTextStyle}>({candidate.patternLabel})</span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={downloadWriteup} style={{ ...buttonStyle, marginTop: "12px" }}>Writeup Markdownを保存</button>
        </section>
      </div>

      <section style={{ ...sectionStyle, marginTop: "16px" }}>
        <h3 style={{ fontSize: "14px", color: "var(--accent)", marginBottom: "12px" }}>操作履歴</h3>
        {operations.length === 0 ? (
          <p style={smallTextStyle}>変換を実行すると、ここに手順が蓄積されます。</p>
        ) : (
          <div style={{ display: "grid", gap: "8px" }}>
            {operations.map((operation) => (
              <div key={operation.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                <strong style={{ fontSize: "13px" }}>{operation.transformLabel}</strong>
                <div style={smallTextStyle}>{new Date(operation.createdAt).toLocaleString()} / {operation.success ? "success" : "failed"}</div>
                <div style={smallTextStyle}>input: {operation.inputPreview || "なし"}</div>
                <div style={smallTextStyle}>output: {operation.outputPreview || "なし"}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
