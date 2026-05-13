import type { CtfTransform, CtfTransformResult } from "./types";

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder("utf-8", { fatal: false });
const MAX_BRUTEFORCE_LINES = 256;
const PRINTABLE_RATIO_THRESHOLD = 0.85;

const toPreview = (input: string, maxLength = 4000) =>
  input.length > maxLength ? `${input.slice(0, maxLength)}\n...省略 (${input.length} chars)` : input;

const bytesToBase64 = (bytes: Uint8Array) => {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
};

const base64ToBytes = (input: string) => {
  const normalized = input.replace(/\s+/g, "");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const normalizeHex = (input: string) => input.replace(/(?:0x|\\x|\s|:|-)/gi, "");

const hexToBytes = (input: string) => {
  const normalized = normalizeHex(input);
  if (normalized.length === 0 || normalized.length % 2 !== 0 || /[^0-9a-f]/i.test(normalized)) {
    return null;
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
};

const bytesToHex = (input: string) =>
  Array.from(TEXT_ENCODER.encode(input), (byte) => byte.toString(16).padStart(2, "0")).join("");

const caesar = (input: string, shift: number) =>
  input.replace(/[a-z]/gi, (char) => {
    const base = char >= "a" && char <= "z" ? 97 : 65;
    const code = char.charCodeAt(0) - base;
    return String.fromCharCode(((code + shift + 26) % 26) + base);
  });

const printableRatio = (input: string) => {
  if (input.length === 0) {
    return 0;
  }
  const printable = Array.from(input).filter((char) => /[\t\n\r -~]/.test(char)).length;
  return printable / input.length;
};

const makeResult = (label: string, output: string, note?: string): CtfTransformResult => ({
  label,
  output: toPreview(output),
  success: true,
  note,
});

export const CTF_TRANSFORMS: CtfTransform[] = [
  {
    id: "base64-decode",
    label: "Base64 decode",
    category: "decode",
    description: "Base64らしい文字列をUTF-8文字列へ復号します。",
    run: (input) => {
      try {
        return [makeResult("Base64 decode", TEXT_DECODER.decode(base64ToBytes(input)))];
      } catch {
        return [{ label: "Base64 decode", output: "Base64として復号できませんでした。", success: false }];
      }
    },
  },
  {
    id: "base64-encode",
    label: "Base64 encode",
    category: "encode",
    description: "入力文字列をBase64へ変換します。",
    run: (input) => [makeResult("Base64 encode", bytesToBase64(TEXT_ENCODER.encode(input)))],
  },
  {
    id: "hex-decode",
    label: "Hex decode",
    category: "decode",
    description: "16進数文字列をUTF-8文字列へ復号します。",
    run: (input) => {
      const bytes = hexToBytes(input);
      if (!bytes) {
        return [{ label: "Hex decode", output: "Hexとして復号できませんでした。", success: false }];
      }
      return [makeResult("Hex decode", TEXT_DECODER.decode(bytes))];
    },
  },
  {
    id: "hex-encode",
    label: "Hex encode",
    category: "encode",
    description: "入力文字列を16進数表現へ変換します。",
    run: (input) => [makeResult("Hex encode", bytesToHex(input))],
  },
  {
    id: "url-decode",
    label: "URL decode",
    category: "decode",
    description: "%xx形式やURLエンコード文字列を復号します。",
    run: (input) => {
      try {
        return [makeResult("URL decode", decodeURIComponent(input.replace(/\+/g, " ")))];
      } catch {
        return [{ label: "URL decode", output: "URLエンコードとして復号できませんでした。", success: false }];
      }
    },
  },
  {
    id: "url-encode",
    label: "URL encode",
    category: "encode",
    description: "入力文字列をURLエンコードします。",
    run: (input) => [makeResult("URL encode", encodeURIComponent(input))],
  },
  {
    id: "rot13",
    label: "ROT13",
    category: "decode",
    description: "英字にROT13を適用します。",
    run: (input) => [makeResult("ROT13", caesar(input, 13))],
  },
  {
    id: "caesar-bruteforce",
    label: "Caesar brute force",
    category: "bruteforce",
    description: "Caesar暗号の全シフトを列挙します。",
    run: (input) =>
      Array.from({ length: 25 }, (_, index) => {
        const shift = index + 1;
        return makeResult(`shift ${shift}`, caesar(input, shift));
      }),
  },
  {
    id: "xor-single-byte-bruteforce",
    label: "XOR single-byte brute force",
    category: "bruteforce",
    description: "Hex入力に対してsingle-byte XORを試し、printableな候補を出します。",
    run: (input) => {
      const bytes = hexToBytes(input);
      if (!bytes) {
        return [{ label: "XOR brute force", output: "XOR brute forceはHex入力が必要です。", success: false }];
      }

      return Array.from({ length: 256 }, (_, key) => {
        const decoded = TEXT_DECODER.decode(bytes.map((byte) => byte ^ key));
        return { key, decoded, score: printableRatio(decoded) };
      })
        .filter((candidate) => candidate.score >= PRINTABLE_RATIO_THRESHOLD)
        .slice(0, MAX_BRUTEFORCE_LINES)
        .map((candidate) =>
          makeResult(
            `key 0x${candidate.key.toString(16).padStart(2, "0")}`,
            candidate.decoded,
            `printable ratio ${candidate.score.toFixed(2)}`
          )
        );
    },
  },
  {
    id: "jwt-decode",
    label: "JWT decode",
    category: "decode",
    description: "JWTのheader/payloadをJSONとして読みやすく表示します。",
    run: (input) => {
      const parts = input.trim().split(".");
      if (parts.length < 2) {
        return [{ label: "JWT decode", output: "JWT形式ではありません。", success: false }];
      }
      const decodePart = (part: string) => {
        const padded = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
        const json = TEXT_DECODER.decode(base64ToBytes(padded));
        return JSON.stringify(JSON.parse(json), null, 2);
      };
      try {
        return [
          makeResult("JWT header", decodePart(parts[0])),
          makeResult("JWT payload", decodePart(parts[1])),
        ];
      } catch {
        return [{ label: "JWT decode", output: "JWTのheader/payloadをJSONとして復号できませんでした。", success: false }];
      }
    },
  },
];
