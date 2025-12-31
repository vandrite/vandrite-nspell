/**
 * @vandrite/nspell - Modern Hunspell-compatible spell checker
 *
 * A TypeScript spell checker with DAWG-based storage for memory efficiency.
 */

import { DAWG } from "./util/dawg";
import { parseAffix } from "./util/affix";
import { suggest as suggestImpl } from "./util/suggest";
import { form } from "./util/form";
import { apply } from "./util/apply";
import {
  toString,
  parseDicLine,
  hasFlag,
  splitLines,
  parseFlags,
  normalize,
} from "./util";
import type {
  AffixData,
  DictionaryInput,
  NSpellInput,
  SpellResult,
} from "./types";

/** Empty flags array constant */
const NO_RULES: string[] = [];

/**
 * NSpell - Hunspell-compatible spell checker
 */
export class NSpell {
  /** DAWG-based word storage */
  private dawg: DAWG;

  /** Affix data */
  private affixData: AffixData;

  /** Compiled compound rules as RegExp */
  private compiledCompoundRules: RegExp[];

  constructor(aff: NSpellInput, dic?: string | Uint8Array | ArrayBuffer) {
    this.dawg = new DAWG();
    this.compiledCompoundRules = [];

    let affContent: string;
    let dictionaries: DictionaryInput[] = [];

    // Parse input formats (matching original nspell exactly)
    if (
      typeof aff === "string" ||
      aff instanceof Uint8Array ||
      aff instanceof ArrayBuffer
    ) {
      affContent = toString(aff);
      if (dic !== undefined) {
        dictionaries = [{ aff: affContent, dic }];
      }
    } else if (Array.isArray(aff)) {
      if (aff.length === 0 || !aff[0]?.aff) {
        throw new Error("Missing `aff` in dictionary");
      }
      affContent = toString(aff[0].aff);
      dictionaries = aff;
    } else if (aff && typeof aff === "object" && "aff" in aff) {
      affContent = toString(aff.aff);
      if (aff.dic) {
        dictionaries = [aff];
      }
    } else {
      throw new Error("Missing `aff` in dictionary");
    }

    // Parse affix file
    this.affixData = parseAffix(affContent);

    // Compile compound rules to RegExp
    this.compileCompoundRules();

    // Load dictionaries
    for (const dict of dictionaries) {
      if (dict.dic) {
        this.loadDictionary(toString(dict.dic));
      }
    }
  }

  /**
   * Compile compound rules to RegExp for efficient matching
   */
  private compileCompoundRules(): void {
    for (const rule of this.affixData.compoundRules) {
      try {
        // Build pattern from rule chars (flags that can be combined)
        let pattern = "";
        let i = 0;
        let valid = true;

        while (i < rule.length && valid) {
          const char = rule[i];

          if (char === "*") {
            pattern += "*";
          } else if (char === "?") {
            pattern += "?";
          } else if (char === "(") {
            // Optional group
            let group = "";
            i++;
            while (i < rule.length && rule[i] !== ")") {
              group += rule[i];
              i++;
            }
            pattern += `(${group})?`;
          } else {
            // Flag character - matches words with this flag
            const words = this.affixData.compoundRuleCodes.get(char);
            if (words && words.length > 0) {
              pattern += `(${words.map(this.escapeRegex).join("|")})`;
            } else {
              // No words with this flag - skip this rule entirely
              valid = false;
            }
          }
          i++;
        }

        if (valid && pattern) {
          this.compiledCompoundRules.push(new RegExp(`^${pattern}$`));
        }
      } catch {
        // Skip invalid patterns
      }
    }
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Load a dictionary file into the DAWG
   */
  private loadDictionary(content: string): void {
    const lines = splitLines(content);
    const flagFormat = this.affixData.flags.FLAG;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip first line if it's just a count
      if (i === 0 && /^\d+$/.test(line.trim())) {
        continue;
      }

      const { word, flags } = parseDicLine(line);
      if (!word) continue;

      // Re-parse flags with correct format
      const parsedFlags =
        flags.length > 0 ? parseFlags(flags.join(""), flagFormat) : [];

      // Add to DAWG and generate forms
      this.addWord(word, parsedFlags);
    }
  }

  /**
   * Add a word with its flags to the dictionary, generating all forms
   */
  private addWord(word: string, codes: string[]): void {
    const needAffixFlag = this.affixData.flags.NEEDAFFIX;

    // Don't add word directly if it has NEEDAFFIX flag
    if (!needAffixFlag || !codes.includes(needAffixFlag)) {
      this.dawg.add(word, codes.length > 0 ? codes : undefined);
    }

    // Process each flag
    for (const code of codes) {
      // Track for compound rules
      const compoundWords = this.affixData.compoundRuleCodes.get(code);
      if (compoundWords) {
        compoundWords.push(word);
      }

      // Apply affix rules
      const rule = this.affixData.rules.get(code);
      if (rule) {
        const newWords = apply(word, rule, this.affixData.rules, []);

        for (const newWord of newWords) {
          if (!this.dawg.has(newWord)) {
            this.dawg.add(newWord, NO_RULES);
          }

          // Handle combineable rules (prefix + suffix)
          if (rule.combineable) {
            for (const otherCode of codes) {
              if (otherCode === code) continue;

              const otherRule = this.affixData.rules.get(otherCode);
              if (
                otherRule &&
                otherRule.combineable &&
                otherRule.type !== rule.type
              ) {
                const combined = apply(
                  newWord,
                  otherRule,
                  this.affixData.rules,
                  []
                );
                for (const combinedWord of combined) {
                  if (!this.dawg.has(combinedWord)) {
                    this.dawg.add(combinedWord, NO_RULES);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Check if a word is spelled correctly
   */
  correct(word: string): boolean {
    return this.spell(word).correct;
  }

  /**
   * Get detailed spell check result
   */
  spell(word: string): SpellResult {
    const result: SpellResult = {
      correct: false,
      forbidden: false,
      warn: false,
    };

    if (!word) return result;

    // Normalize input
    const normalized = normalize(word.trim(), this.affixData.conversion.in);
    if (!normalized) return result;

    // Find the word form
    const foundForm = form(
      this.dawg,
      this.affixData.flags,
      this.affixData.conversion.in,
      normalized,
      true // include forbidden for checking
    );

    if (foundForm !== null) {
      const flags = this.dawg.getFlags(foundForm);
      result.correct = true;

      // Check for forbidden (both explicit flag and internal marker)
      const forbiddenFlag = this.affixData.flags.FORBIDDENWORD;
      if (hasFlag(flags, forbiddenFlag) || hasFlag(flags, "__FORBIDDEN__")) {
        result.correct = false;
        result.forbidden = true;
      }

      // Check for warn
      if (hasFlag(flags, this.affixData.flags.WARN)) {
        result.warn = true;
        if (this.affixData.flags.FORBIDWARN) {
          result.correct = false;
        }
      }
    } else {
      // Try compound words
      if (this.checkCompound(normalized)) {
        result.correct = true;
      }
    }

    return result;
  }

  /**
   * Check if word is a valid compound
   */
  private checkCompound(word: string): boolean {
    const minLen = this.affixData.flags.COMPOUNDMIN;
    if (word.length < minLen * 2) return false;

    // Only check compounds if compound rules are defined
    if (this.compiledCompoundRules.length === 0) {
      return false;
    }

    // Check against compiled compound rules only
    for (const rule of this.compiledCompoundRules) {
      if (rule.test(word)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get spelling suggestions for a misspelled word
   */
  suggest(word: string): string[] {
    return suggestImpl(
      this.dawg,
      this.affixData,
      this.compiledCompoundRules,
      word,
      (w) => this.correct(w)
    );
  }

  /**
   * Add a word to the dictionary
   */
  add(word: string, model?: string): this {
    if (!word) return this;

    let flags: string[] = [];
    if (model) {
      flags = this.dawg.getFlags(model) || [];
    }

    this.addWord(word, flags);
    return this;
  }

  /**
   * Remove a word from the dictionary
   */
  remove(word: string): this {
    this.dawg.remove(word);
    return this;
  }

  /**
   * Add additional dictionary data
   */
  dictionary(dic: string | Uint8Array | ArrayBuffer): this {
    this.loadDictionary(toString(dic));
    return this;
  }

  /**
   * Add personal dictionary data
   *
   * Format:
   * - "word" - add word
   * - "*word" - mark as forbidden
   * - "word/model" - add word with model's flags
   */
  personal(dic: string | Uint8Array | ArrayBuffer): this {
    const content = toString(dic);
    const lines = splitLines(content);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith("*")) {
        // Forbidden word
        const word = trimmed.slice(1);
        const forbiddenFlag =
          this.affixData.flags.FORBIDDENWORD || "__FORBIDDEN__";
        const existingFlags = this.dawg.getFlags(word) || [];
        this.dawg.add(word, [...existingFlags, forbiddenFlag]);
      } else if (trimmed.includes("/")) {
        // Word with model
        const slashIdx = trimmed.indexOf("/");
        const word = trimmed.slice(0, slashIdx);
        const model = trimmed.slice(slashIdx + 1);
        this.add(word, model);
      } else {
        // Simple word
        this.add(trimmed);
      }
    }

    return this;
  }

  /**
   * Get word characters defined by the affix file
   */
  wordCharacters(): string | undefined {
    return this.affixData.flags.WORDCHARS;
  }

  /**
   * Get statistics about the loaded dictionary
   */
  getStats(): { words: number; nodes: number; avgDepth: number } {
    return this.dawg.getStats();
  }

  /**
   * Get the DAWG for advanced usage
   */
  get data(): DAWG {
    return this.dawg;
  }
}

// Default export
export default NSpell;

// Re-export types
export type {
  DictionaryInput,
  NSpellInput,
  SpellResult,
  LoadOptions,
} from "./types";

// Re-export DAWG for advanced usage
export { DAWG } from "./util/dawg";
