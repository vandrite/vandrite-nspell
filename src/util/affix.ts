/**
 * Affix file (.aff) parser
 *
 * Parses Hunspell affix files to extract rules, flags, and settings.
 */

import type { AffixData, AffixFlags, AffixEntry, AffixRule } from "../types";
import { splitLines, endRegex, startRegex, parseFlags } from "./index";

// Whitespace regex for splitting
const WHITESPACE = /\s+/;

// Default keyboard layout for suggestions
const DEFAULT_KEYBOARD = [
  "qwertzuop",
  "yxcvbnm",
  "qaw",
  "say",
  "wse",
  "dsx",
  "sy",
  "edr",
  "fdc",
  "dx",
  "rft",
  "gfv",
  "fc",
  "tgz",
  "hgb",
  "gv",
  "zhu",
  "jhn",
  "hb",
  "uji",
  "kjm",
  "jn",
  "iko",
  "lkm",
];

// Letters sorted by frequency in English
const ALPHABET = "etaoinshrdlcumwfgypbvkjxqz".split("");

/**
 * Parse an affix file content
 */
export function parseAffix(content: string): AffixData {
  const rules = new Map<string, AffixRule>();
  const compoundRuleCodes = new Map<string, string[]>();
  const replacementTable: [string, string][] = [];
  const conversion: AffixData["conversion"] = { in: [], out: [] };
  const compoundRules: string[] = [];
  const flags: AffixFlags = {
    KEY: [],
    TRY: [],
    COMPOUNDMIN: 3,
  };

  // Process lines
  const rawLines = splitLines(content);
  const lines: string[] = [];

  // Filter out comments and empty lines
  for (const line of rawLines) {
    const trimmed = line.trim();
    // Skip empty lines and comments (lines starting with #)
    if (trimmed && trimmed.charCodeAt(0) !== 35) {
      lines.push(trimmed);
    }
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const parts = line.split(WHITESPACE);
    const directive = parts[0];

    switch (directive) {
      case "REP": {
        // Replacement table
        const count = parseInt(parts[1], 10);
        for (let j = 1; j <= count && i + j < lines.length; j++) {
          const repParts = lines[i + j].split(WHITESPACE);
          if (repParts[0] === "REP" && repParts[1] && repParts[2]) {
            replacementTable.push([repParts[1], repParts[2]]);
          }
        }
        i += count;
        break;
      }

      case "ICONV":
      case "OCONV": {
        // Input/output conversion
        const count = parseInt(parts[1], 10);
        const target = directive === "ICONV" ? conversion.in : conversion.out;

        for (let j = 1; j <= count && i + j < lines.length; j++) {
          const convParts = lines[i + j].split(WHITESPACE);
          if (convParts[0] === directive && convParts[1] && convParts[2]) {
            try {
              target.push([new RegExp(convParts[1], "g"), convParts[2]]);
            } catch {
              // Skip invalid regex
            }
          }
        }
        i += count;
        break;
      }

      case "COMPOUNDRULE": {
        // Compound word rules
        const count = parseInt(parts[1], 10);
        for (let j = 1; j <= count && i + j < lines.length; j++) {
          const ruleParts = lines[i + j].split(WHITESPACE);
          if (ruleParts[0] === "COMPOUNDRULE" && ruleParts[1]) {
            const rule = ruleParts[1];
            compoundRules.push(rule);

            // Extract flags from rule pattern
            for (const char of rule) {
              if (
                char !== "*" &&
                char !== "?" &&
                char !== "(" &&
                char !== ")"
              ) {
                if (!compoundRuleCodes.has(char)) {
                  compoundRuleCodes.set(char, []);
                }
              }
            }
          }
        }
        i += count;
        break;
      }

      case "PFX":
      case "SFX": {
        // Prefix/Suffix rules
        const flag = parts[1];
        const combineable = parts[2] === "Y";
        const count = parseInt(parts[3], 10);

        const rule: AffixRule = {
          type: directive,
          combineable,
          entries: [],
        };

        for (let j = 1; j <= count && i + j < lines.length; j++) {
          const entryParts = lines[i + j].split(WHITESPACE);

          if (entryParts[0] !== directive || entryParts[1] !== flag) {
            continue;
          }

          const remove = entryParts[2];
          const addWithFlags = entryParts[3];
          const condition = entryParts[4];

          // Parse add part and continuation flags
          const addParts = addWithFlags ? addWithFlags.split("/") : ["0"];
          const add = addParts[0] === "0" ? "" : addParts[0];
          const continuation = addParts[1]
            ? parseFlags(addParts[1], flags.FLAG)
            : [];

          try {
            const entry: AffixEntry = {
              add,
              remove: remove === "0" ? "" : remove,
              match: null,
              continuation,
            };

            // Build match regex
            if (condition && condition !== ".") {
              entry.match =
                directive === "SFX"
                  ? endRegex(condition)
                  : startRegex(condition);
            }

            rule.entries.push(entry);
          } catch {
            // Skip entries with invalid regex patterns
          }
        }

        rules.set(flag, rule);
        i += count;
        break;
      }

      case "TRY": {
        // Characters to try for suggestions
        const tryChars = parts[1] || "";
        const chars: string[] = [];

        for (const char of tryChars) {
          if (char === char.toLowerCase()) {
            chars.push(char);
          }
        }

        // Add missing alphabet letters
        for (const letter of ALPHABET) {
          if (!tryChars.includes(letter)) {
            chars.push(letter);
          }
        }

        flags.TRY = chars;
        break;
      }

      case "KEY": {
        // Keyboard layout
        const keyGroups = parts[1] ? parts[1].split("|") : [];
        flags.KEY.push(...keyGroups);
        break;
      }

      case "COMPOUNDMIN": {
        flags.COMPOUNDMIN = parseInt(parts[1], 10) || 3;
        break;
      }

      case "ONLYINCOMPOUND": {
        flags.ONLYINCOMPOUND = parts[1];
        if (parts[1]) {
          compoundRuleCodes.set(parts[1], []);
        }
        break;
      }

      case "FLAG": {
        // Flag format
        const format = parts[1];
        if (format === "long" || format === "num" || format === "UTF-8") {
          flags.FLAG = format;
        }
        break;
      }

      case "NOSUGGEST":
      case "WARN":
      case "FORBIDDENWORD":
      case "KEEPCASE":
      case "NEEDAFFIX":
      case "WORDCHARS":
      case "COMPOUNDFLAG":
      case "COMPOUNDBEGIN":
      case "COMPOUNDMIDDLE":
      case "COMPOUNDLAST": {
        flags[directive] = parts[1];
        break;
      }

      case "FORBIDWARN": {
        flags.FORBIDWARN = true;
        break;
      }

      default: {
        // Store any other flags
        if (parts[1]) {
          flags[directive] = parts[1];
        }
        break;
      }
    }

    i++;
  }

  // Apply defaults
  if (flags.KEY.length === 0) {
    flags.KEY = DEFAULT_KEYBOARD;
  }

  if (flags.TRY.length === 0) {
    flags.TRY = [...ALPHABET];
  }

  return {
    compoundRuleCodes,
    replacementTable,
    conversion,
    compoundRules,
    rules,
    flags,
  };
}
