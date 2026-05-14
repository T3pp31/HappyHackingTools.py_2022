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
    return "";
  }

  const bytes = normalizedInput.match(/.{2}/g)?.map((hex) => parseInt(hex, 16)) ?? [];
  return textDecoder.decode(Uint8Array.from(bytes));
};

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
    id: "rot13",
    label: "ROT13",
    category: "crypto",
    description: "英字に ROT13 を適用します。",
    run: (input) => ({
      output: Array.from(input, (character) => rotateAsciiLetter(character, 13)).join(""),
    }),
  },
] as const satisfies readonly CtfTransform[];
