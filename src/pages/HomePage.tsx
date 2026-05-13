import React from "react";
import { Link } from "react-router-dom";

const WORKFLOW_STEPS = [
  { title: "観察", description: "怪しい文字列・ファイル種別・strings・magic bytesを確認する" },
  { title: "仮説", description: "Base64、Hex、URL encode、hash、flag形式の可能性を整理する" },
  { title: "試行", description: "decode / encode / brute forceを実行し、結果を次の入力へつなげる" },
  { title: "記録", description: "操作履歴・メモ・flag候補を残してwriteupへ変換する" },
] as const;

const PRIMARY_ACTIONS = [
  { to: "/ctf", title: "CTF Workspace", description: "文字列解析、変換、flag候補抽出、writeup作成を開始" },
  { to: "/binary", title: "Artifact Analyzer", description: "問題ファイルのmagic bytes、hash、strings、flag候補を確認" },
] as const;

const ADVANCED_ACTIONS = [
  { to: "/web-check", title: "Web Check" },
  { to: "/lanscan", title: "LAN Scan" },
  { to: "/portscan", title: "Port Scan" },
  { to: "/arp-spoof", title: "ARP Spoof" },
] as const;

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "20px",
};

const linkCardStyle: React.CSSProperties = {
  ...cardStyle,
  display: "block",
  textDecoration: "none",
  color: "var(--text-primary)",
};

const mutedStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "13px",
};

export const HomePage: React.FC = () => {
  return (
    <div>
      <h2 style={{ marginBottom: "8px", fontSize: "22px" }}>CTF Solver Workbench</h2>
      <p style={{ ...mutedStyle, marginBottom: "20px" }}>
        HappyHackingTools は、CTF初心者〜中級者が問題ファイルや怪しい文字列を安全に解析し、解法の流れを記録しながらflagに近づくためのローカルファーストなデスクトップ作業環境です。
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "16px" }}>
        {PRIMARY_ACTIONS.map((action) => (
          <Link key={action.to} to={action.to} style={linkCardStyle}>
            <h3 style={{ color: "var(--accent)", fontSize: "16px", marginBottom: "8px" }}>{action.title}</h3>
            <p style={mutedStyle}>{action.description}</p>
          </Link>
        ))}
      </div>

      <section style={{ ...cardStyle, marginBottom: "16px" }}>
        <h3 style={{ color: "var(--accent)", fontSize: "16px", marginBottom: "12px" }}>判断基準</h3>
        <p style={mutedStyle}>その機能は、CTF問題を解くときの「観察 → 仮説 → 試行 → 記録 → flag発見」のどこを楽にするか？</p>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" }}>
        {WORKFLOW_STEPS.map((step) => (
          <section key={step.title} style={cardStyle}>
            <h3 style={{ color: "var(--accent)", fontSize: "14px", marginBottom: "8px" }}>{step.title}</h3>
            <p style={mutedStyle}>{step.description}</p>
          </section>
        ))}
      </div>

      <section style={cardStyle}>
        <h3 style={{ color: "var(--accent)", fontSize: "16px", marginBottom: "12px" }}>Advanced / Network Lab</h3>
        <p style={{ ...mutedStyle, marginBottom: "12px" }}>
          LAN Scan、Port Scan、ARP SpoofはCTF解法の中心ではなく、許可済み環境で使う上級者向けネットワーク検証機能として隔離しています。
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {ADVANCED_ACTIONS.map((action) => (
            <Link key={action.to} to={action.to} style={{ color: "var(--accent)", fontSize: "13px" }}>{action.title}</Link>
          ))}
        </div>
      </section>
    </div>
  );
};
