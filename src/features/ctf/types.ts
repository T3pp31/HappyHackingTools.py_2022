export type CtfOperationStatus = "success" | "failure";

export type CtfArtifactKind =
  | "file"
  | "url"
  | "command-output"
  | "note"
  | "other";

export interface CtfArtifact {
  id: string;
  name: string;
  kind: CtfArtifactKind;
  createdAt: string;
  description?: string;
  path?: string;
  metadata?: Record<string, string>;
}

export interface CtfOperation {
  id: string;
  name: string;
  inputSummary: string;
  outputSummary: string;
  executedAt: string;
  status: CtfOperationStatus;
  notes: string;
}

export interface CtfObservation {
  id: string;
  summary: string;
  createdAt: string;
  detail?: string;
  sourceArtifactId?: string;
  sourceOperationId?: string;
  tags?: string[];
}

export interface FlagCandidate {
  id: string;
  value: string;
  createdAt: string;
  confidence: "low" | "medium" | "high";
  notes?: string;
  sourceOperationId?: string;
  isFinal?: boolean;
}

export interface CtfWorkspace {
  id: string;
  challengeName: string;
  createdAt: string;
  updatedAt: string;
  category?: string;
  description?: string;
  notes: string;
  artifacts: CtfArtifact[];
  observations: CtfObservation[];
  operations: CtfOperation[];
  flagCandidates: FlagCandidate[];
  finalFlag?: string;
}
