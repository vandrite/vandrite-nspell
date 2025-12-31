/**
 * Utility functions for text processing
 */

import type { CasingType } from "../types";

/**
 * Convert buffer/Uint8Array to string
 */
export function toString(value: string | Uint8Array | ArrayBuffer): string {
  if (typeof value === "string") return value;
  if (value instanceof ArrayBuffer) {
    return new TextDecoder().decode(value);
  }
  return new TextDecoder().decode(value);
}

/**
 * Detect the casing type of a word
 */
export function detectCasing(word: string): CasingType {
  if (!word) return null;

  const lower = word.toLowerCase();
  const upper = word.toUpperCase();

  if (word === lower) {
    return "lower";
  }

  if (word === upper) {
    return "upper";
  }

  // Check if only first letter is uppercase
  if (word[0] === word[0].toUpperCase() && word.slice(1) === lower.slice(1)) {
    return "capitalized";
  }

  return "mixed";
}

/**
 * Apply casing to a word based on a model word's casing
 */
export function applyCasing(word: string, casing: CasingType): string {
  switch (casing) {
    case "lower":
      return word.toLowerCase();
    case "upper":
      return word.toUpperCase();
    case "capitalized":
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    default:
      return word;
  }
}

/**
 * Normalize a word using input conversion rules
 */
export function normalize(
  word: string,
  conversions: [RegExp, string][]
): string {
  let result = word;
  for (const [pattern, replacement] of conversions) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Apply output conversion rules to a word
 */
export function denormalize(
  word: string,
  conversions: [RegExp, string][]
): string {
  let result = word;
  for (const [pattern, replacement] of conversions) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Check if a word has a specific flag
 */
export function hasFlag(
  flags: string[] | undefined,
  flag: string | undefined
): boolean {
  if (!flag || !flags) return false;
  return flags.includes(flag);
}

/**
 * Parse a line from a .dic file
 * Format: word/flags or just word
 */
export function parseDicLine(line: string): { word: string; flags: string[] } {
  const trimmed = line.trim();
  if (!trimmed) {
    return { word: "", flags: [] };
  }

  // Handle escaped slashes
  const slashIndex = findUnescapedSlash(trimmed);

  if (slashIndex === -1) {
    return { word: trimmed, flags: [] };
  }

  const word = trimmed.slice(0, slashIndex);
  const flagStr = trimmed.slice(slashIndex + 1);

  return {
    word: word.replace(/\\\//g, "/"), // Unescape slashes in word
    flags: parseFlags(flagStr),
  };
}

/**
 * Find the first unescaped slash in a string
 */
function findUnescapedSlash(str: string): number {
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "/" && (i === 0 || str[i - 1] !== "\\")) {
      return i;
    }
  }
  return -1;
}

/**
 * Parse flag string based on format (default: single character flags)
 */
export function parseFlags(
  flagStr: string,
  format: "short" | "long" | "num" | "UTF-8" = "short"
): string[] {
  if (!flagStr) return [];

  switch (format) {
    case "long":
      // Two-character flags
      const longFlags: string[] = [];
      for (let i = 0; i < flagStr.length; i += 2) {
        longFlags.push(flagStr.slice(i, i + 2));
      }
      return longFlags;

    case "num":
      // Comma-separated numeric flags
      return flagStr
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

    case "UTF-8":
    case "short":
    default:
      // Single character flags (including UTF-8)
      return [...flagStr];
  }
}

/**
 * Split text into lines, handling different line endings
 */
export function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

/**
 * Create a regex that matches at the end of a string
 */
export function endRegex(pattern: string): RegExp {
  return new RegExp(pattern + "$");
}

/**
 * Create a regex that matches at the start of a string
 */
export function startRegex(pattern: string): RegExp {
  return new RegExp("^" + pattern);
}
