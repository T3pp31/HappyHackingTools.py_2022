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
