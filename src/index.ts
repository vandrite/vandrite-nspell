/**
 * @vandrite/nspell - Modern Hunspell-compatible spell checker
 *
 * A TypeScript spell checker with DAWG-based storage for memory efficiency.
 */

import { DAWG } from './util/dawg';
import { parseAffix } from './util/affix';
import { suggest as suggestImpl } from './util/suggest';
import { form } from './util/form';
import { apply } from './util/apply';
import { toString, hasFlag, splitLines, parseFlags, normalize } from './util';
import { LRUCache } from './util/lru-cache';
import type { AffixData, DictionaryInput, NSpellInput, SpellResult } from './types';

/** Empty flags array constant */
const NO_RULES: string[] = [];

/**
 * NSpell - Hunspell-compatible spell checker
 */
export class NSpell {
  private dawg: DAWG;
  private affixData: AffixData;
  private compiledCompoundRules: RegExp[];

  // LRU cache for correct() results
  private correctCache = new Map<string, boolean>();
  private readonly CACHE_SIZE = 5000;

  // LRU cache for suggest() results
  private suggestCache = new LRUCache<string, string[]>(1000);

  constructor(aff: NSpellInput, dic?: string | Uint8Array | ArrayBuffer) {
    this.dawg = new DAWG();
    this.compiledCompoundRules = [];

    let affContent: string;
    let dictionaries: DictionaryInput[] = [];

    // Parse input formats (matching original nspell exactly)
    if (typeof aff === 'string' || aff instanceof Uint8Array || aff instanceof ArrayBuffer) {
      affContent = toString(aff);
      if (dic !== undefined) {
        dictionaries = [{ aff: affContent, dic }];
      }
    } else if (Array.isArray(aff)) {
      if (aff.length === 0 || !aff[0]?.aff) {
        throw new Error('Missing `aff` in dictionary');
      }
      affContent = toString(aff[0].aff);
      dictionaries = aff;
    } else if (aff && typeof aff === 'object' && 'aff' in aff) {
      affContent = toString(aff.aff);
      if (aff.dic) {
        dictionaries = [aff];
      }
    } else {
      throw new Error('Missing `aff` in dictionary');
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
        let pattern = '';
        let i = 0;
        let valid = true;

        while (i < rule.length && valid) {
          const char = rule[i];

          if (char === '*') {
            pattern += '*';
          } else if (char === '?') {
            pattern += '?';
          } else if (char === '(') {
            // Optional group
            let group = '';
            i++;
            while (i < rule.length && rule[i] !== ')') {
              group += rule[i];
              i++;
            }
            pattern += `(${group})?`;
          } else {
            // Flag character - matches words with this flag
            const words = this.affixData.compoundRuleCodes.get(char);
            if (words && words.length > 0) {
              pattern += `(${words.map(this.escapeRegex).join('|')})`;
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
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Load a dictionary file into the DAWG
   */
  private loadDictionary(content: string): void {
    const len = content.length;
    let start = 0;
    let lineCount = 0;
    const flagFormat = this.affixData.flags.FLAG;
    const rules = this.affixData.rules;
    const needAffixFlag = this.affixData.flags.NEEDAFFIX;
    const compoundRuleCodes = this.affixData.compoundRuleCodes;

    while (start < len) {
      let end = content.indexOf('\n', start);
      if (end === -1) end = len;

      // Handle CR for CRLF
      let lineEnd = end;
      if (lineEnd > start && content.charCodeAt(lineEnd - 1) === 13) {
        // \r
        lineEnd--;
      }

      // Skip first line if it's just a count (all digits)
      if (lineCount === 0) {
        let isDigitOnly = true;
        for (let j = start; j < lineEnd && isDigitOnly; j++) {
          const c = content.charCodeAt(j);
          if (c < 48 || c > 57) isDigitOnly = false; // 0-9
        }
        if (isDigitOnly && lineEnd > start) {
          start = end + 1;
          lineCount++;
          continue;
        }
      }

      // Find split point for word/flags (first unescaped slash)
      let slashIndex = -1;
      for (let j = start; j < lineEnd; j++) {
        if (content.charCodeAt(j) === 47) {
          // /
          if (j === start || content.charCodeAt(j - 1) !== 92) {
            // not escaped (\)
            slashIndex = j;
            break;
          }
        }
      }

      let word: string;
      let parsedFlags: string[];

      if (slashIndex === -1) {
        word = content.slice(start, lineEnd);
        parsedFlags = [];
      } else {
        word = content.slice(start, slashIndex);
        const flagStr = content.slice(slashIndex + 1, lineEnd);
        parsedFlags = parseFlags(flagStr, flagFormat);
      }

      if (word) {
        this.addWord(word, parsedFlags, rules, needAffixFlag, compoundRuleCodes);
      }

      start = end + 1;
      lineCount++;
    }
  }

  /**
   * Add a word with its flags to the dictionary
   */
  private addWord(
    word: string,
    codes: string[],
    rules: Map<string, import('./types').AffixRule>,
    needAffixFlag: string | undefined,
    compoundRuleCodes: Map<string, string[]>,
  ): void {
    if (!needAffixFlag || !codes.includes(needAffixFlag)) {
      this.dawg.add(word, codes.length > 0 ? codes : undefined);
    }

    const len = codes.length;
    if (len === 0) return;

    for (let i = 0; i < len; i++) {
      const code = codes[i];

      const compoundWords = compoundRuleCodes.get(code);
      if (compoundWords) {
        compoundWords.push(word);
      }

      const rule = rules.get(code);
      if (rule) {
        const newWords = apply(word, rule, rules, []);
        const newWordsLen = newWords.length;

        for (let j = 0; j < newWordsLen; j++) {
          const newWord = newWords[j];
          this.dawg.add(newWord, NO_RULES);

          if (rule.combineable) {
            for (let k = 0; k < len; k++) {
              if (k === i) continue;
              const otherCode = codes[k];
              const otherRule = rules.get(otherCode);
              if (otherRule && otherRule.combineable && otherRule.type !== rule.type) {
                const combined = apply(newWord, otherRule, rules, []);
                const combinedLen = combined.length;
                for (let l = 0; l < combinedLen; l++) {
                  this.dawg.add(combined[l], NO_RULES);
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
    if (!word) return false;

    const trimmed = word.trim();
    if (!trimmed) return false;

    // Check cache first
    const cacheKey = trimmed;
    const cached = this.correctCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const conversions = this.affixData.conversion.in;
    const normalized = conversions.length > 0 ? normalize(trimmed, conversions) : trimmed;
    const keepCase = this.affixData.flags.KEEPCASE;

    // Try all case variations
    const lower = normalized.toLowerCase();
    const candidates = [normalized];
    if (lower !== normalized) candidates.push(lower);
    if (normalized === normalized.toUpperCase() && normalized.length > 1) {
      candidates.push(normalized.charAt(0) + normalized.slice(1).toLowerCase());
    }

    for (let i = 0; i < candidates.length; i++) {
      const node = this.dawg.findNodePublic(candidates[i]);
      if (node?.isEnd && this.isValidWord(node.flags)) {
        if (!keepCase || !node.flags?.includes(keepCase) || i === 0) {
          this.setCacheResult(cacheKey, true);
          return true;
        }
      }
    }

    const result = this.checkCompound(normalized);
    this.setCacheResult(cacheKey, result);
    return result;
  }

  private setCacheResult(key: string, value: boolean): void {
    if (this.correctCache.size >= this.CACHE_SIZE) {
      const firstKey = this.correctCache.keys().next().value;
      if (firstKey) this.correctCache.delete(firstKey);
    }
    this.correctCache.set(key, value);
  }

  /**
   * Check if a word with given flags is valid (not forbidden, not compound-only)
   */
  private isValidWord(flags: string[] | undefined): boolean {
    if (!flags || flags.length === 0) return true;

    // Check forbidden
    const forbiddenFlag = this.affixData.flags.FORBIDDENWORD;
    if (forbiddenFlag && flags.includes(forbiddenFlag)) return false;
    if (flags.includes('__FORBIDDEN__')) return false;

    // Check ONLYINCOMPOUND
    const onlyInCompound = this.affixData.flags.ONLYINCOMPOUND;
    if (onlyInCompound && flags.includes(onlyInCompound)) return false;

    return true;
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
      true, // include forbidden for checking
    );

    if (foundForm !== null) {
      const flags = this.dawg.getFlags(foundForm);
      result.correct = true;

      // Check for forbidden (both explicit flag and internal marker)
      const forbiddenFlag = this.affixData.flags.FORBIDDENWORD;
      if (hasFlag(flags, forbiddenFlag) || hasFlag(flags, '__FORBIDDEN__')) {
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

    const rules = this.compiledCompoundRules;
    const rulesLen = rules.length;
    if (rulesLen === 0) return false;

    for (let i = 0; i < rulesLen; i++) {
      if (rules[i].test(word)) return true;
    }
    return false;
  }

  /**
   * Get spelling suggestions for a misspelled word
   */
  suggest(word: string): string[] {
    const trimmed = word.trim();
    if (!trimmed) return [];

    // Check cache first
    const cached = this.suggestCache.get(trimmed);
    if (cached) return cached;

    const result = suggestImpl(
      this.dawg,
      this.affixData,
      this.compiledCompoundRules,
      trimmed,
      (w) => this.correct(w),
    );

    // Cache result
    this.suggestCache.set(trimmed, result);
    return result;
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

    this.addWord(
      word,
      flags,
      this.affixData.rules,
      this.affixData.flags.NEEDAFFIX,
      this.affixData.compoundRuleCodes,
    );
    this.correctCache.clear();
    this.suggestCache.clear();
    return this;
  }
  /**
   * Remove a word from the dictionary
   */
  remove(word: string): this {
    this.dawg.remove(word);
    this.correctCache.clear();
    this.suggestCache.clear();
    return this;
  }

  /**
   * Add additional dictionary data
   */
  dictionary(dic: string | Uint8Array | ArrayBuffer): this {
    this.loadDictionary(toString(dic));
    this.correctCache.clear();
    this.suggestCache.clear();
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

      if (trimmed.startsWith('*')) {
        // Forbidden word
        const word = trimmed.slice(1);
        const forbiddenFlag = this.affixData.flags.FORBIDDENWORD || '__FORBIDDEN__';
        const existingFlags = this.dawg.getFlags(word) || [];
        this.dawg.add(word, [...existingFlags, forbiddenFlag]);
      } else if (trimmed.includes('/')) {
        // Word with model
        const slashIdx = trimmed.indexOf('/');
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

  /**
   * Export suggestion cache for persistence (e.g., localStorage, file)
   * Returns a JSON-serializable object
   */
  exportCache(): { entries: [string, string[]][]; maxSize: number } {
    return this.suggestCache.toJSON();
  }

  /**
   * Import previously exported suggestion cache
   * @param data - Data from exportCache()
   */
  importCache(data: { entries: [string, string[]][]; maxSize?: number }): void {
    this.suggestCache.fromJSON(data);
  }
}

// Default export
export default NSpell;

// Re-export types
export type { DictionaryInput, NSpellInput, SpellResult, LoadOptions } from './types';

// Re-export DAWG for advanced usage
export { DAWG } from './util/dawg';
