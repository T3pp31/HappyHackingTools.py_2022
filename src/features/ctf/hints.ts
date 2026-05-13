import type { CtfHintSection } from "./types";

export const CTF_HINT_SECTIONS = [
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
] as const satisfies readonly CtfHintSection[];
