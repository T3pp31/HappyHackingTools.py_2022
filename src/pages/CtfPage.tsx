import React, { useMemo, useRef, useState } from "react";
import {
  CTF_TRANSFORMS,
  analyzeCtfInput,
  summarizeText,
  transformCtfInput,
  type CandidateKind,
  type CtfCandidate,
  type CtfTransformId,
  type CtfTransformResult,
} from "../features/ctf";
import { buttonStyle, dangerButtonStyle, inputStyle, labelStyle } from "../styles/formStyles";

type HistoryItem = {
  id: string;
  transformName: string;
  inputSummary: string;
  outputSummary: string;
  timestamp: string;
};

const candidateGroups: readonly {
  kind: CandidateKind;
  title: string;
  emptyMessage: string;
}[] = [
  { kind: "flag", title: "flag形式候補", emptyMessage: "flag候補は未検出です。" },
  { kind: "base64", title: "Base64らしい文字列", emptyMessage: "Base64候補は未検出です。" },
  { kind: "hex", title: "Hexらしい文字列", emptyMessage: "Hex候補は未検出です。" },
  { kind: "urlEncoded", title: "URL encodeらしい文字列", emptyMessage: "URL encode候補は未検出です。" },
  { kind: "printable", title: "printable strings候補", emptyMessage: "printable strings候補は未検出です。" },
] as const;

const pageDescription =
  "貼り付けたテキストや選択したファイル内容を解析し、CTFで頻出するエンコード変換とflag候補抽出を行います。";

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "16px",
};

const headingStyle: React.CSSProperties = {
  color: "var(--accent)",
  fontSize: "14px",
  marginBottom: "10px",
};

const mutedStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "13px",
};

const preStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-tertiary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--text-primary)",
  fontSize: "12px",
  maxHeight: "260px",
  overflow: "auto",
  padding: "12px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: "var(--bg-tertiary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};

const createHistoryId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const formatTimestamp = (date: Date) =>
  new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

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
            backgroundColor: "var(--bg-tertiary)",
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

export const CtfPage: React.FC = () => {
  const [input, setInput] = useState("");
  const [selectedTransform, setSelectedTransform] = useState<CtfTransformId>(CTF_TRANSFORMS[0].id);
  const [result, setResult] = useState<CtfTransformResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analysis = useMemo(() => analyzeCtfInput(input), [input]);
  const canTransform = input.length > 0;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    setFileName(file.name);
    const text = await file.text();
    setInput(text);
  };

  const handleTransform = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canTransform) {
      setError("変換する入力を貼り付けるか、ファイルを選択してください。");
      return;
    }

    try {
      const nextResult = transformCtfInput(selectedTransform, input);
      setResult(nextResult);
      setError(null);
      setHistory((current) => [
        {
          id: createHistoryId(),
          transformName: nextResult.name,
          inputSummary: summarizeText(input),
          outputSummary: summarizeText(nextResult.output),
          timestamp: formatTimestamp(new Date()),
        },
        ...current,
      ]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "変換に失敗しました。");
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
      <p style={{ ...mutedStyle, marginBottom: "20px" }}>{pageDescription}</p>

      <div style={{ display: "grid", gap: "16px" }}>
        <section style={cardStyle}>
          <h3 style={headingStyle}>入力エリア</h3>
          <label style={labelStyle}>テキスト貼り付け</label>
          <textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setFileName(null);
            }}
            placeholder="flag{...}、Base64、Hex dump、URL encoded textなどを貼り付け"
            style={{
              ...inputStyle,
              minHeight: "160px",
              resize: "vertical",
              width: "100%",
            }}
          />
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginTop: "12px",
            }}
          >
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
          <h3 style={headingStyle}>自動解析パネル</h3>
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {candidateGroups.map((group) => (
              <div key={group.kind}>
                <h4 style={{ color: "var(--text-primary)", fontSize: "13px", marginBottom: "8px" }}>{group.title}</h4>
                {renderCandidateList(analysis[group.kind], group.emptyMessage)}
              </div>
            ))}
          </div>
        </section>

        <section style={cardStyle}>
          <h3 style={headingStyle}>変換パネル</h3>
          <form onSubmit={handleTransform} style={{ display: "grid", gap: "12px" }}>
            <div>
              <label style={labelStyle}>変換</label>
              <select
                value={selectedTransform}
                onChange={(event) => setSelectedTransform(event.target.value as CtfTransformId)}
                style={{ ...inputStyle, width: "100%" }}
              >
                {CTF_TRANSFORMS.map((transform) => (
                  <option key={transform.id} value={transform.id}>
                    {transform.label}
                  </option>
                ))}
              </select>
            </div>
            <p style={{ ...mutedStyle, margin: 0 }}>
              {CTF_TRANSFORMS.find((transform) => transform.id === selectedTransform)?.description}
            </p>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
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
          {error && <p style={{ color: "var(--danger)", fontSize: "13px", marginTop: "10px" }}>{error}</p>}
        </section>

        <section style={cardStyle}>
          <h3 style={headingStyle}>結果パネル</h3>
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
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
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
          {copyMessage && <p style={{ color: "var(--accent)", fontSize: "13px", marginTop: "10px" }}>{copyMessage}</p>}
        </section>

        <section style={cardStyle}>
          <h3 style={headingStyle}>操作履歴パネル</h3>
          {history.length > 0 ? (
            <div style={{ display: "grid", gap: "10px" }}>
              {history.map((item) => (
                <div
                  key={item.id}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    display: "grid",
                    gap: "6px",
                    paddingBottom: "10px",
                  }}
                >
                  <strong style={{ color: "var(--text-primary)", fontSize: "13px" }}>{item.transformName}</strong>
                  <span style={mutedStyle}>入力概要: {item.inputSummary}</span>
                  <span style={mutedStyle}>出力概要: {item.outputSummary}</span>
                  <span style={{ ...mutedStyle, fontSize: "12px" }}>タイムスタンプ: {item.timestamp}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={mutedStyle}>まだ操作履歴はありません。</p>
          )}
        </section>
      </div>
    </div>
  );
};
