import type { FlagPattern } from "./types";

export const DEFAULT_FLAG_PATTERNS = [
  {
    id: "flag-braces",
    label: "flag{...}",
    source: "flag\\{[^}]+\\}",
    flags: "gi",
    description: "一般的な flag{...} 形式を検出します。",
  },
  {
    id: "ctf-braces",
    label: "ctf{...}",
    source: "ctf\\{[^}]+\\}",
    flags: "gi",
    description: "イベント名を省略した ctf{...} 形式を検出します。",
  },
  {
    id: "htb-braces",
    label: "HTB{...}",
    source: "HTB\\{[^}]+\\}",
    flags: "g",
    description: "Hack The Box でよく使われる HTB{...} 形式を検出します。",
  },
  {
    id: "picoctf-braces",
    label: "picoCTF{...}",
    source: "picoCTF\\{[^}]+\\}",
    flags: "g",
    description: "picoCTF でよく使われる picoCTF{...} 形式を検出します。",
  },
] as const satisfies readonly FlagPattern[];

export const buildFlagPatternRegex = (pattern: FlagPattern): RegExp => {
  const flags = pattern.flags?.includes("g") ? pattern.flags : `${pattern.flags ?? ""}g`;
  return new RegExp(pattern.source, flags);
};
