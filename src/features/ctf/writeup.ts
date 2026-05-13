import type { CtfWorkspace } from "./types";

const EMPTY_VALUE = "_未記録_";

const normalizeLines = (value?: string): string => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : EMPTY_VALUE;
};

const listItems = (items: string[]): string =>
  items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : `- ${EMPTY_VALUE}`;

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const generateCtfWriteupMarkdown = (workspace: CtfWorkspace): string => {
  const finalFlag =
    workspace.finalFlag ??
    workspace.flagCandidates.find((candidate) => candidate.isFinal)?.value;

  const sections = [
    `# ${normalizeLines(workspace.challengeName)}`,
    "## Challenge",
    [
      `- Category: ${normalizeLines(workspace.category)}`,
      `- Created: ${formatDateTime(workspace.createdAt)}`,
      `- Updated: ${formatDateTime(workspace.updatedAt)}`,
      "",
      normalizeLines(workspace.description),
      "",
      "### Notes",
      normalizeLines(workspace.notes),
    ].join("\n"),
    "## Observations",
    listItems(
      workspace.observations.map((observation) => {
        const tags = observation.tags?.length ? ` [${observation.tags.join(", ")}]` : "";
        const detail = observation.detail ? ` — ${observation.detail}` : "";
        return `${observation.summary}${detail}${tags}`;
      })
    ),
    "## Steps",
    listItems(
      workspace.operations.map(
        (operation) =>
          `**${operation.name}** (${operation.status}, ${formatDateTime(operation.executedAt)})\n  - Input: ${normalizeLines(operation.inputSummary)}\n  - Output: ${normalizeLines(operation.outputSummary)}\n  - Notes: ${normalizeLines(operation.notes)}`
      )
    ),
    "## Interesting Values",
    listItems(
      workspace.artifacts.map((artifact) => {
        const location = artifact.path ? ` (${artifact.path})` : "";
        const description = artifact.description ? ` — ${artifact.description}` : "";
        return `${artifact.name} [${artifact.kind}]${location}${description}`;
      })
    ),
    "## Flag Candidates",
    listItems(
      workspace.flagCandidates.map((candidate) => {
        const marker = candidate.isFinal ? " final" : "";
        const notes = candidate.notes ? ` — ${candidate.notes}` : "";
        return `\`${candidate.value}\` (${candidate.confidence}${marker})${notes}`;
      })
    ),
    "## Final Flag",
    normalizeLines(finalFlag),
  ];

  return `${sections.join("\n\n")}\n`;
};
