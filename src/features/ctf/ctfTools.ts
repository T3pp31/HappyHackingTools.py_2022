export type CandidateKind = "flag" | "base64" | "hex" | "urlEncoded" | "printable";

export type CtfCandidate = {
  kind: CandidateKind;
  value: string;
  note?: string;
};

export type CtfAnalysis = Record<CandidateKind, CtfCandidate[]>;

export type CtfTransformId =
  | "base64Decode"
  | "base64Encode"
  | "hexDecode"
  | "hexEncode"
  | "urlDecode"
  | "urlEncode"
  | "rot13"
  | "caesarBruteForce"
  | "singleByteXorBruteForce";

export type CtfTransform = {
  id: CtfTransformId;
  label: string;
  description: string;
};

export type CtfTransformResult = {
  name: string;
  output: string;
  flagCandidates: CtfCandidate[];
};

const CANDIDATE_LIMIT = 20;
const PRINTABLE_MIN_LENGTH = 4;
const XOR_RESULT_LIMIT = 16;
const SUMMARY_LENGTH = 80;

export const CTF_TRANSFORMS: readonly CtfTransform[] = [
  {
    id: "base64Decode",
    label: "Base64 decode",
    description: "Base64文字列をUTF-8テキストとして復号します。",
  },
  {
    id: "base64Encode",
    label: "Base64 encode",
    description: "入力テキストをUTF-8としてBase64化します。",
  },
  {
    id: "hexDecode",
    label: "Hex decode",
    description: "16進文字列をUTF-8テキストへ変換します。",
  },
  {
    id: "hexEncode",
    label: "Hex encode",
    description: "入力テキストをUTF-8バイト列の16進表現へ変換します。",
  },
  {
    id: "urlDecode",
    label: "URL decode",
    description: "percent encodingをデコードします。",
  },
  {
    id: "urlEncode",
    label: "URL encode",
    description: "入力テキストをURL安全な表現へエンコードします。",
  },
  {
    id: "rot13",
    label: "ROT13",
    description: "英字にROT13を適用します。",
  },
  {
    id: "caesarBruteForce",
    label: "Caesar brute force",
    description: "Caesar暗号の1〜25シフトを総当たりします。",
  },
  {
    id: "singleByteXorBruteForce",
    label: "single-byte XOR brute force",
    description: "1バイトXOR鍵を総当たりし、読みやすい候補を上位表示します。",
  },
] as const;

const emptyAnalysis = (): CtfAnalysis => ({
  flag: [],
  base64: [],
  hex: [],
  urlEncoded: [],
  printable: [],
});

const uniqueByValue = (items: CtfCandidate[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}:${item.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const collectMatches = (input: string, regex: RegExp, kind: CandidateKind, note?: string) =>
  uniqueByValue(
    Array.from(input.matchAll(regex), (match) => ({
      kind,
      value: match[0],
      note,
    })),
  ).slice(0, CANDIDATE_LIMIT);

export const analyzeCtfInput = (input: string): CtfAnalysis => {
  const analysis = emptyAnalysis();
  if (!input.trim()) {
    return analysis;
  }

  analysis.flag = collectMatches(
    input,
    /(?:[A-Za-z0-9_-]{0,32}(?:CTF|ctf)|flag|FLAG)\{[^}\r\n]{1,200}\}/g,
    "flag",
    "一般的なflag{...} / CTF{...}形式",
  );
  analysis.base64 = collectMatches(
    input,
    /(?:^|[^A-Za-z0-9+/=])([A-Za-z0-9+/]{8,}={0,2})(?=$|[^A-Za-z0-9+/=])/g,
    "base64",
    "Base64文字種で8文字以上",
  ).map((candidate) => ({ ...candidate, value: candidate.value.trim().replace(/^[^A-Za-z0-9+/=]/, "") }))
    .filter((candidate) => candidate.value.length % 4 === 0);
  analysis.hex = collectMatches(
    input,
    /(?:0x)?(?:[0-9a-fA-F]{2}[\s:-]?){4,}/g,
    "hex",
    "偶数個の16進バイト列",
  );
  analysis.urlEncoded = collectMatches(
    input,
    /(?:%[0-9a-fA-F]{2}){2,}|(?:[A-Za-z0-9_.~-]|%[0-9a-fA-F]{2})*%[0-9a-fA-F]{2}(?:[A-Za-z0-9_.~-]|%[0-9a-fA-F]{2})*/g,
    "urlEncoded",
    "percent encodingを含む文字列",
  );
  analysis.printable = collectMatches(
    input,
    new RegExp(`[\\x20-\\x7e]{${PRINTABLE_MIN_LENGTH},}`, "g"),
    "printable",
    `${PRINTABLE_MIN_LENGTH}文字以上の表示可能ASCII`,
  );

  return analysis;
};

export const summarizeText = (value: string, maxLength = SUMMARY_LENGTH) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "(empty)";
  }
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}…`
    : normalized;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const bytesToBinary = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");

const binaryToBytes = (binary: string) =>
  Uint8Array.from(binary, (char) => char.charCodeAt(0));

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const parseHexBytes = (input: string) => {
  const normalized = input.replace(/^0x/i, "").replace(/[\s:_-]/g, "");
  if (!normalized || normalized.length % 2 !== 0 || /[^0-9a-fA-F]/.test(normalized)) {
    throw new Error("Hex decodeには偶数桁の16進文字列を入力してください。");
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return bytes;
};

const rot = (input: string, shift: number) =>
  input.replace(/[A-Za-z]/g, (char) => {
    const base = char >= "a" ? 97 : 65;
    return String.fromCharCode(((char.charCodeAt(0) - base + shift) % 26) + base);
  });

const scoreEnglishLikeText = (value: string) => {
  let score = 0;
  for (const char of value) {
    if (/[etaoin shrdluETAOINSHRDLU]/.test(char)) score += 2;
    else if (/[ -~]/.test(char)) score += 1;
    else score -= 8;
  }
  if (/flag\{|ctf\{/i.test(value)) score += 40;
  return score;
};

const decodeXorInput = (input: string) => {
  try {
    return parseHexBytes(input);
  } catch {
    return textEncoder.encode(input);
  }
};

const runTransform = (id: CtfTransformId, input: string) => {
  switch (id) {
    case "base64Decode":
      return textDecoder.decode(binaryToBytes(atob(input.replace(/\s+/g, ""))));
    case "base64Encode":
      return btoa(bytesToBinary(textEncoder.encode(input)));
    case "hexDecode":
      return textDecoder.decode(parseHexBytes(input));
    case "hexEncode":
      return bytesToHex(textEncoder.encode(input));
    case "urlDecode":
      return decodeURIComponent(input.replace(/\+/g, " "));
    case "urlEncode":
      return encodeURIComponent(input);
    case "rot13":
      return rot(input, 13);
    case "caesarBruteForce":
      return Array.from({ length: 25 }, (_, index) => {
        const shift = index + 1;
        return `shift ${shift.toString().padStart(2, "0")}: ${rot(input, shift)}`;
      }).join("\n");
    case "singleByteXorBruteForce": {
      const bytes = decodeXorInput(input);
      return Array.from({ length: 256 }, (_, key) => {
        const decoded = textDecoder.decode(bytes.map((byte) => byte ^ key));
        return { key, decoded, score: scoreEnglishLikeText(decoded) };
      })
        .sort((a, b) => b.score - a.score)
        .slice(0, XOR_RESULT_LIMIT)
        .map(({ key, decoded }) => `key 0x${key.toString(16).padStart(2, "0")}: ${decoded}`)
        .join("\n");
    }
    default: {
      const exhaustiveCheck: never = id;
      return exhaustiveCheck;
    }
  }
};

export const transformCtfInput = (
  id: CtfTransformId,
  input: string,
): CtfTransformResult => {
  const transform = CTF_TRANSFORMS.find((item) => item.id === id);
  if (!transform) {
    throw new Error("未対応の変換です。");
  }
  const output = runTransform(id, input);
  return {
    name: transform.label,
    output,
    flagCandidates: analyzeCtfInput(output).flag,
  };
};
