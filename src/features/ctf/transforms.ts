import type { CtfTransform } from "./types";

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

const fromBase64 = (input: string): string => {
  const binary = atob(input.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return textDecoder.decode(bytes);
};

const toBase64 = (input: string): string => {
  const bytes = textEncoder.encode(input);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary);
};

const fromHex = (input: string): string => {
  const normalizedInput = input.replace(/(?:0x|\s|:|-)/gi, "");
  if (normalizedInput.length % 2 !== 0 || /[^0-9a-f]/i.test(normalizedInput)) {
    throw new Error("Hex decodeには偶数桁の16進文字列を入力してください。");
  }

  const bytes = normalizedInput.match(/.{2}/g)?.map((hex) => parseInt(hex, 16)) ?? [];
  return textDecoder.decode(Uint8Array.from(bytes));
};

const toHex = (input: string): string =>
  Array.from(textEncoder.encode(input), (byte) => byte.toString(16).padStart(2, "0")).join("");

const rotateAsciiLetter = (character: string, shift: number): string => {
  const code = character.charCodeAt(0);
  const upperA = 65;
  const upperZ = 90;
  const lowerA = 97;
  const lowerZ = 122;

  if (code >= upperA && code <= upperZ) {
    return String.fromCharCode(((code - upperA + shift) % 26) + upperA);
  }

  if (code >= lowerA && code <= lowerZ) {
    return String.fromCharCode(((code - lowerA + shift) % 26) + lowerA);
  }

  return character;
};

const rotateText = (input: string, shift: number): string =>
  Array.from(input, (character) => rotateAsciiLetter(character, shift)).join("");

const scoreEnglishLikeText = (value: string): number => {
  let score = 0;
  for (const character of value) {
    if (/[etaoin shrdluETAOINSHRDLU]/.test(character)) score += 2;
    else if (/[ -~]/.test(character)) score += 1;
    else score -= 8;
  }
  if (/flag\{|ctf\{/i.test(value)) score += 40;
  return score;
};

const decodeXorInput = (input: string): Uint8Array => {
  try {
    const normalizedInput = input.replace(/(?:0x|\s|:|-)/gi, "");
    if (
      normalizedInput.length === 0 ||
      normalizedInput.length % 2 !== 0 ||
      /[^0-9a-f]/i.test(normalizedInput)
    ) {
      throw new Error("not hex");
    }
    return Uint8Array.from(normalizedInput.match(/.{2}/g) ?? [], (hex) => parseInt(hex, 16));
  } catch {
    return textEncoder.encode(input);
  }
};

export const CTF_TRANSFORMS = [
  {
    id: "base64-decode",
    label: "Base64 Decode",
    category: "encoding",
    description: "Base64 文字列を UTF-8 テキストとして復号します。",
    run: (input) => ({ output: fromBase64(input) }),
  },
  {
    id: "base64-encode",
    label: "Base64 Encode",
    category: "encoding",
    description: "UTF-8 テキストを Base64 文字列に変換します。",
    run: (input) => ({ output: toBase64(input) }),
  },
  {
    id: "url-decode",
    label: "URL Decode",
    category: "web",
    description: "URL エンコードされた文字列を復号します。",
    run: (input) => ({ output: decodeURIComponent(input.replace(/\+/g, " ")) }),
  },
  {
    id: "url-encode",
    label: "URL Encode",
    category: "web",
    description: "文字列を URL コンポーネントとしてエンコードします。",
    run: (input) => ({ output: encodeURIComponent(input) }),
  },
  {
    id: "hex-decode",
    label: "Hex Decode",
    category: "encoding",
    description: "16 進表現を UTF-8 テキストとして復号します。",
    run: (input) => ({ output: fromHex(input) }),
  },
  {
    id: "hex-encode",
    label: "Hex Encode",
    category: "encoding",
    description: "UTF-8 テキストを 16 進表現に変換します。",
    run: (input) => ({ output: toHex(input) }),
  },
  {
    id: "rot13",
    label: "ROT13",
    category: "crypto",
    description: "英字に ROT13 を適用します。",
    run: (input) => ({ output: rotateText(input, 13) }),
  },
  {
    id: "caesar-bruteforce",
    label: "Caesar Brute Force",
    category: "crypto",
    description: "Caesar 暗号の 1 から 25 シフトを総当たりします。",
    run: (input) => ({
      output: Array.from({ length: 25 }, (_, index) => {
        const shift = index + 1;
        return `shift ${shift.toString().padStart(2, "0")}: ${rotateText(input, shift)}`;
      }).join("\n"),
    }),
  },
  {
    id: "single-byte-xor-bruteforce",
    label: "Single-byte XOR Brute Force",
    category: "crypto",
    description: "1 バイト XOR 鍵を総当たりし、読みやすい候補を上位表示します。",
    run: (input) => {
      const bytes = decodeXorInput(input);
      const output = Array.from({ length: 256 }, (_, key) => {
        const decoded = textDecoder.decode(Uint8Array.from(bytes, (byte) => byte ^ key));
        return { key, decoded, score: scoreEnglishLikeText(decoded) };
      })
        .sort((left, right) => right.score - left.score)
        .slice(0, 16)
        .map(({ key, decoded }) => `key 0x${key.toString(16).padStart(2, "0")}: ${decoded}`)
        .join("\n");

      return { output };
    },
  },
] as const satisfies readonly CtfTransform[];
