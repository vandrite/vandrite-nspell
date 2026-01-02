/**
 * Apply affix rules to generate word forms
 */

import type { AffixRule } from '../types';

/** Apply a single affix rule to a word, generating all possible forms */
export function apply(
  value: string,
  rule: AffixRule,
  rules: Map<string, AffixRule>,
  words: string[],
): string[] {
  const entries = rule.entries;
  const entriesLen = entries.length;
  const isSuffix = rule.type === 'SFX';
  const valueLen = value.length;

  for (let i = 0; i < entriesLen; i++) {
    const entry = entries[i];
    const match = entry.match;

    // Check match condition
    if (match && !match.test(value)) continue;

    const remove = entry.remove;
    const add = entry.add;
    let next: string;

    if (remove) {
      const removeLen = remove.length;
      if (isSuffix) {
        // Suffix: remove from end of word
        if (removeLen > valueLen) continue;
        // Manual endsWith check (faster)
        let matches = true;
        for (let j = 0; j < removeLen && matches; j++) {
          if (value.charCodeAt(valueLen - removeLen + j) !== remove.charCodeAt(j)) {
            matches = false;
          }
        }
        if (!matches) continue;
        next = value.slice(0, valueLen - removeLen) + add;
      } else {
        // Prefix: remove from start of word
        if (removeLen > valueLen) continue;
        // Manual startsWith check (faster)
        let matches = true;
        for (let j = 0; j < removeLen && matches; j++) {
          if (value.charCodeAt(j) !== remove.charCodeAt(j)) {
            matches = false;
          }
        }
        if (!matches) continue;
        next = add + value.slice(removeLen);
      }
    } else {
      // No removal, just add
      next = isSuffix ? value + add : add + value;
    }

    words.push(next);

    // Handle continuation rules
    const continuation = entry.continuation;
    if (continuation && continuation.length > 0) {
      const contLen = continuation.length;
      for (let j = 0; j < contLen; j++) {
        const continuationRule = rules.get(continuation[j]);
        if (continuationRule) {
          apply(next, continuationRule, rules, words);
        }
      }
    }
  }

  return words;
}

/** Generate all word forms by applying all applicable affix rules */
export function generateForms(
  word: string,
  flags: string[],
  rules: Map<string, AffixRule>,
): string[] {
  const forms: string[] = [word];

  for (const flag of flags) {
    const rule = rules.get(flag);
    if (rule) {
      const newForms = apply(word, rule, rules, []);

      for (const form of newForms) {
        if (!forms.includes(form)) {
          forms.push(form);
        }

        // Handle combineable rules (prefix + suffix combinations)
        if (rule.combineable) {
          for (const otherFlag of flags) {
            if (otherFlag === flag) continue;

            const otherRule = rules.get(otherFlag);
            if (otherRule && otherRule.combineable && otherRule.type !== rule.type) {
              const combinedForms = apply(form, otherRule, rules, []);
              for (const combined of combinedForms) {
                if (!forms.includes(combined)) {
                  forms.push(combined);
                }
              }
            }
          }
        }
      }
    }
  }

  return forms;
}
