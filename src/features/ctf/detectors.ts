import type { CtfDetection, FlagPattern } from "./types";
import { collectFlagCandidates, DEFAULT_FLAG_PATTERNS } from "./flagPatterns";

const MAX_DETECTIONS_PER_KIND = 8;

const uniqueMatches = (input: string, pattern: RegExp) => {
  const seen = new Set<string>();
  return Array.from(input.matchAll(pattern))
    .map((match) => match[0])
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    })
    .slice(0, MAX_DETECTIONS_PER_KIND);
};

export const detectCtfArtifacts = (
  input: string,
  flagPatterns: FlagPattern[] = DEFAULT_FLAG_PATTERNS
): CtfDetection[] => {
  const detections: CtfDetection[] = [];

  collectFlagCandidates(input, flagPatterns).forEach((candidate) => {
    detections.push({
      id: `flag:${candidate.value}`,
      label: `flag候補 (${candidate.patternLabel})`,
      value: candidate.value,
      confidence: "high",
      recommendation: "flag候補として記録し、問題の指定フォーマットと一致するか確認してください。",
    });
  });

  uniqueMatches(input, /(?:[A-Za-z0-9+/]{12,}={0,2})/g).forEach((value) => {
    detections.push({
      id: `base64:${value}`,
      label: "Base64らしい文字列",
      value,
      confidence: value.endsWith("=") ? "high" : "medium",
      recommendation: "Base64 decodeを試す価値があります。",
    });
  });

  uniqueMatches(input, /(?:0x)?(?:[0-9a-fA-F]{2}[\s:-]?){8,}/g).forEach((value) => {
    detections.push({
      id: `hex:${value}`,
      label: "Hexらしい文字列",
      value,
      confidence: "medium",
      recommendation: "Hex decodeやsingle-byte XOR brute forceを試してください。",
    });
  });

  uniqueMatches(input, /(?:%[0-9a-fA-F]{2}){2,}/g).forEach((value) => {
    detections.push({
      id: `url:${value}`,
      label: "URL encodeらしい文字列",
      value,
      confidence: "high",
      recommendation: "URL decodeを試してください。",
    });
  });

  uniqueMatches(input, /\b[a-fA-F0-9]{32}\b|\b[a-fA-F0-9]{40}\b|\b[a-fA-F0-9]{64}\b/g).forEach((value) => {
    detections.push({
      id: `hash:${value}`,
      label: "Hashらしい文字列",
      value,
      confidence: "medium",
      recommendation: "MD5/SHA1/SHA256の可能性があります。必要に応じてhash lookupへコピーしてください。",
    });
  });

  return detections;
};
