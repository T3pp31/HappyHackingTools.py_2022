import type { CtfOperation, CtfTransform, CtfTransformResult } from "./types";

const makeId = () => `op-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const preview = (input: string, maxLength = 180) => {
  const singleLine = input.replace(/\s+/g, " ").trim();
  return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength)}…` : singleLine;
};

export const createOperation = (
  transform: CtfTransform,
  result: CtfTransformResult,
  input: string
): CtfOperation => ({
  id: makeId(),
  transformId: transform.id,
  transformLabel: `${transform.label}: ${result.label}`,
  inputPreview: preview(input),
  outputPreview: preview(result.output),
  output: result.output,
  createdAt: new Date().toISOString(),
  success: result.success,
  note: result.note,
});
