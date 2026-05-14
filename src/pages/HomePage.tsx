import React from "react";
import { NavLink } from "react-router-dom";

type QuickAction = {
  title: string;
  description: string;
  actionLabel: string;
  to: string;
};

type WorkspaceSummary = {
  id: string;
  title: string;
  updatedAt: string;
  status: string;
};

type FlagCandidate = {
  id: string;
  value: string;
  source: string;
  confidence: string;
};

const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    title: "調査メモから始める",
    description: "CTFでよく使う調査観点やコマンドを確認し、解析の初動を整理します。",
    actionLabel: "CTF Reference を開く",
    to: "/ctf",
  },
  {
    title: "ファイル解析から始める",
    description: "配布ファイルを読み込み、hex dump と decoded text を確認します。",
    actionLabel: "Artifact Analyzer を開く",
    to: "/binary",
  },
] as const;

const RECENT_WORKSPACES: readonly WorkspaceSummary[] = [];
const FLAG_CANDIDATES: readonly FlagCandidate[] = [];

const pageStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

const heroStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "24px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "16px",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "18px",
};

const mutedTextStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "13px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "16px",
  marginBottom: "12px",
};

const actionLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  marginTop: "14px",
  color: "#000",
  backgroundColor: "var(--accent)",
  borderRadius: "var(--radius)",
  padding: "8px 12px",
  fontSize: "12px",
  fontWeight: 700,
};

const emptyStateStyle: React.CSSProperties = {
  ...cardStyle,
  borderStyle: "dashed",
  color: "var(--text-secondary)",
  fontSize: "13px",
};

export const HomePage: React.FC = () => {
  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <p style={{ ...mutedTextStyle, marginBottom: "6px" }}>
          Local-first CTF Assistant
        </p>
        <h2 style={{ marginBottom: "10px", fontSize: "24px" }}>
          CTF Solver Workbench
        </h2>
        <p style={mutedTextStyle}>
          問題ごとのワークスペースを起点に、入力文字列の変換、配布ファイル解析、flag 候補の整理、writeup 作成までをローカルで進めます。
        </p>
      </section>

      <section>
        <h3 style={sectionTitleStyle}>クイックスタート</h3>
        <div style={gridStyle}>
          {QUICK_ACTIONS.map((action) => (
            <article key={action.title} style={cardStyle}>
              <h4 style={{ color: "var(--accent)", fontSize: "14px", marginBottom: "8px" }}>
                {action.title}
              </h4>
              <p style={mutedTextStyle}>{action.description}</p>
              <NavLink to={action.to} style={actionLinkStyle}>
                {action.actionLabel}
              </NavLink>
            </article>
          ))}
        </div>
      </section>

      <section style={gridStyle}>
        <div>
          <h3 style={sectionTitleStyle}>最近のワークスペース</h3>
          {RECENT_WORKSPACES.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {RECENT_WORKSPACES.map((workspace) => (
                <article key={workspace.id} style={cardStyle}>
                  <h4 style={{ fontSize: "14px", marginBottom: "6px" }}>{workspace.title}</h4>
                  <p style={mutedTextStyle}>{workspace.status}</p>
                  <p style={{ ...mutedTextStyle, marginTop: "6px" }}>
                    Updated: {workspace.updatedAt}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div style={emptyStateStyle}>
              まだワークスペース履歴はありません。入力またはファイル解析から開始してください。
            </div>
          )}
        </div>

        <div>
          <h3 style={sectionTitleStyle}>Flag 候補一覧</h3>
          {FLAG_CANDIDATES.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {FLAG_CANDIDATES.map((candidate) => (
                <article key={candidate.id} style={cardStyle}>
                  <code style={{ color: "var(--accent)", fontSize: "13px" }}>
                    {candidate.value}
                  </code>
                  <p style={{ ...mutedTextStyle, marginTop: "8px" }}>
                    Source: {candidate.source} / Confidence: {candidate.confidence}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div style={emptyStateStyle}>
              解析結果から flag 形式らしい文字列を検出すると、ここに候補として表示します。
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
