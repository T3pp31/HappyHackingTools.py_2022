import React from "react";
import { open } from "@tauri-apps/plugin-shell";

interface NpcapDialogProps {
  visible: boolean;
  downloadUrl: string;
  onClose: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const dialogStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "24px",
  maxWidth: "420px",
  width: "90%",
};

const titleStyle: React.CSSProperties = {
  fontSize: "20px",
  color: "var(--text-primary)",
  marginTop: 0,
  marginBottom: "12px",
};

const messageStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-secondary)",
  lineHeight: "1.6",
  marginBottom: "20px",
};

const buttonContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  justifyContent: "flex-end",
};

const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--radius)",
  padding: "8px 16px",
  fontSize: "13px",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-tertiary)",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "8px 16px",
  fontSize: "13px",
  cursor: "pointer",
};

export const NpcapDialog: React.FC<NpcapDialogProps> = ({
  visible,
  downloadUrl,
  onClose,
}) => {
  if (!visible) return null;

  const handleDownload = async () => {
    try {
      await open(downloadUrl);
    } catch {
      // ブラウザを開けない場合は無視する
    }
    onClose();
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={titleStyle}>Npcap Required</h2>
        <p style={messageStyle}>
          This feature requires Npcap to be installed. Please download and
          install Npcap to use network scanning features.
        </p>
        <div style={buttonContainerStyle}>
          <button style={secondaryButtonStyle} onClick={onClose}>
            Close
          </button>
          <button style={primaryButtonStyle} onClick={handleDownload}>
            Download Npcap
          </button>
        </div>
      </div>
    </div>
  );
};
