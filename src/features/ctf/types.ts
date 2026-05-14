export type CtfTransformCategory =
  | "encoding"
  | "crypto"
  | "forensics"
  | "network"
  | "web"
  | "binary";

export interface CtfTransformOptions {
  readonly flagPatterns?: readonly FlagPattern[];
  readonly [key: string]: unknown;
}

export interface CtfTransformResult {
  readonly output: string;
  readonly notes?: readonly string[];
}

export interface CtfTransform {
  readonly id: string;
  readonly label: string;
  readonly category: CtfTransformCategory;
  readonly description: string;
  run(input: string, options?: CtfTransformOptions): CtfTransformResult;
}

export interface DetectionRange {
  readonly start: number;
  readonly end: number;
}

export interface CtfDetection {
  readonly type: string;
  readonly confidence: number;
  readonly range: DetectionRange;
  readonly recommendedActions: readonly string[];
}

export interface CtfDetector {
  readonly id: string;
  readonly label: string;
  detect(input: string, options?: CtfTransformOptions): readonly CtfDetection[];
}

export interface FlagPattern {
  readonly id: string;
  readonly label: string;
  readonly source: string;
  readonly flags?: string;
  readonly description: string;
}

export interface CtfHintSection {
  readonly title: string;
  readonly items: readonly string[];
}

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
