import React from "react";

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

const sectionStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "16px",
  marginBottom: "12px",
};

export const CtfPage: React.FC = () => {
  return (
    <div>
      <h2 style={{ marginBottom: "20px", fontSize: "20px" }}>
        CTF Reference
      </h2>

      {SECTIONS.map((section) => (
        <div key={section.title} style={sectionStyle}>
          <h3 style={{ fontSize: "14px", color: "var(--accent)", marginBottom: "8px" }}>
            {section.title}
          </h3>
          <ul style={{ paddingLeft: "20px", fontSize: "13px", color: "var(--text-secondary)" }}>
            {section.items.map((item, i) => (
              <li key={i} style={{ marginBottom: "4px" }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};
