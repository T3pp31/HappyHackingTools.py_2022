import { DEFAULT_FLAG_PATTERNS, buildFlagPatternRegex } from "./flagPatterns";
import type { CtfDetection, CtfDetector } from "./types";

const BASE64_CANDIDATE_PATTERN = /(?:[A-Za-z0-9+/]{4}){3,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g;
const HEX_CANDIDATE_PATTERN = /(?:0x)?(?:[0-9a-fA-F]{2}[\s:-]?){4,}/g;
const URL_ENCODED_PATTERN = /(?:%[0-9a-fA-F]{2})+/g;

const createDetection = (
  type: string,
  confidence: number,
  start: number,
  end: number,
  recommendedActions: readonly string[],
): CtfDetection => ({
  type,
  confidence,
  range: { start, end },
  recommendedActions,
});

const detectionLength = (detection: CtfDetection): number =>
  detection.range.end - detection.range.start;

const removeOverlappingDetections = (detections: readonly CtfDetection[]): readonly CtfDetection[] => {
  const selectedDetections = [...detections]
    .sort((left, right) =>
      right.confidence - left.confidence || detectionLength(right) - detectionLength(left),
    )
    .reduce<CtfDetection[]>((selected, detection) => {
      const overlaps = selected.some(
        (selectedDetection) =>
          detection.range.start < selectedDetection.range.end &&
          detection.range.end > selectedDetection.range.start,
      );

      return overlaps ? selected : [...selected, detection];
    }, []);

  return selectedDetections.sort((left, right) => left.range.start - right.range.start);
};

export const CTF_DETECTORS = [
  {
    id: "flag-pattern",
    label: "Flag Pattern",
    detect: (input, options) => {
      const patterns = options?.flagPatterns ?? DEFAULT_FLAG_PATTERNS;
      const detections = patterns.flatMap((pattern) =>
        Array.from(input.matchAll(buildFlagPatternRegex(pattern)), (match) =>
          createDetection(
            pattern.id,
            0.95,
            match.index,
            match.index + match[0].length,
            ["検出した flag 候補を提出前に問題文の形式と照合してください。"],
          ),
        ),
      );

      return removeOverlappingDetections(detections);
    },
  },
  {
    id: "base64-candidate",
    label: "Base64 Candidate",
    detect: (input) =>
      Array.from(input.matchAll(BASE64_CANDIDATE_PATTERN), (match) =>
        createDetection("base64", 0.7, match.index, match.index + match[0].length, ["base64-decode"]),
      ),
  },
  {
    id: "hex-candidate",
    label: "Hex Candidate",
    detect: (input) =>
      Array.from(input.matchAll(HEX_CANDIDATE_PATTERN), (match) =>
        createDetection("hex", 0.65, match.index, match.index + match[0].length, ["hex-decode"]),
      ),
  },
  {
    id: "url-encoded-candidate",
    label: "URL Encoded Candidate",
    detect: (input) =>
      Array.from(input.matchAll(URL_ENCODED_PATTERN), (match) =>
        createDetection("url-encoded", 0.6, match.index, match.index + match[0].length, ["url-decode"]),
      ),
  },
] as const satisfies readonly CtfDetector[];
