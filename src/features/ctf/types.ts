export type CtfTransformCategory = "decode" | "encode" | "bruteforce" | "extract";

export interface CtfTransformResult {
  label: string;
  output: string;
  success: boolean;
  note?: string;
}

export interface CtfTransform {
  id: string;
  label: string;
  category: CtfTransformCategory;
  description: string;
  run: (input: string) => CtfTransformResult[];
}

export interface CtfDetection {
  id: string;
  label: string;
  value: string;
  confidence: "low" | "medium" | "high";
  recommendation: string;
}

export interface CtfOperation {
  id: string;
  transformId: string;
  transformLabel: string;
  inputPreview: string;
  outputPreview: string;
  output: string;
  createdAt: string;
  success: boolean;
  note?: string;
}

export interface FlagPattern {
  id: string;
  label: string;
  pattern: RegExp;
}

export interface FlagCandidate {
  patternId: string;
  patternLabel: string;
  value: string;
}

export interface CtfWorkspaceDraft {
  challengeName: string;
  sourceText: string;
  notes: string;
  operations: CtfOperation[];
  flagCandidates: FlagCandidate[];
}
