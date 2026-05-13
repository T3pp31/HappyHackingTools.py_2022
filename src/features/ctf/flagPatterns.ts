import type { FlagPattern } from "./types";

export const DEFAULT_FLAG_PATTERNS: FlagPattern[] = [
  { id: "generic-flag", label: "flag{...}", pattern: /flag\{[^\s{}]{1,120}\}/gi },
  { id: "generic-ctf", label: "ctf{...}", pattern: /ctf\{[^\s{}]{1,120}\}/gi },
  { id: "picoctf", label: "picoCTF{...}", pattern: /picoCTF\{[^\s{}]{1,120}\}/g },
  { id: "htb", label: "HTB{...}", pattern: /HTB\{[^\s{}]{1,120}\}/g },
];

export const collectFlagCandidates = (
  input: string,
  patterns: FlagPattern[] = DEFAULT_FLAG_PATTERNS
) => {
  const seen = new Set<string>();
  return patterns.flatMap((flagPattern) => {
    const matches = Array.from(input.matchAll(flagPattern.pattern));
    return matches.flatMap((match) => {
      const value = match[0];
      const dedupeKey = `${flagPattern.id}:${value}`;
      if (seen.has(dedupeKey)) {
        return [];
      }
      seen.add(dedupeKey);
      return [{ patternId: flagPattern.id, patternLabel: flagPattern.label, value }];
    });
  });
};
