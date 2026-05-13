import type { CtfWorkspaceDraft } from "./types";

const fallbackChallengeName = "untitled-challenge";

const markdownList = (items: string[]) =>
  items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- なし";

export const generateWriteupMarkdown = (draft: CtfWorkspaceDraft) => {
  const challengeName = draft.challengeName.trim() || fallbackChallengeName;
  const sourceSummary = draft.sourceText.trim()
    ? `${draft.sourceText.trim().slice(0, 500)}${draft.sourceText.trim().length > 500 ? "…" : ""}`
    : "入力なし";

  const observations = [
    `入力文字数: ${draft.sourceText.length}`,
    `flag候補数: ${draft.flagCandidates.length}`,
    draft.notes.trim() ? `メモ: ${draft.notes.trim()}` : "メモ: なし",
  ];

  const steps = draft.operations.map(
    (operation, index) =>
      `${index + 1}. ${operation.transformLabel} (${operation.success ? "success" : "failed"})\n   - input: ${operation.inputPreview || "なし"}\n   - output: ${operation.outputPreview || "なし"}${operation.note ? `\n   - note: ${operation.note}` : ""}`
  );

  return `# Challenge: ${challengeName}

## Observations
${markdownList(observations)}

## Source Preview
\`\`\`text
${sourceSummary}
\`\`\`

## Steps
${steps.length > 0 ? steps.join("\n") : "まだ操作履歴はありません。"}

## Flag Candidates
${markdownList(draft.flagCandidates.map((candidate) => `${candidate.value} (${candidate.patternLabel})`))}

## Final Flag
TODO
`;
};
