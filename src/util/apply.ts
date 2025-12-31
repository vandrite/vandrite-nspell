/**
 * Apply affix rules to generate word forms
 *
 * This module handles the application of prefix and suffix rules
 * to generate all valid forms of a word.
 */

import type { AffixRule } from "../types";

/**
 * Apply a single affix rule to a word, generating all possible forms
 *
 * @param value - The base word
 * @param rule - The affix rule to apply
 * @param rules - All available rules (for continuation)
 * @param words - Array to collect generated words
 * @returns The words array with new forms added
 */
export function apply(
  value: string,
  rule: AffixRule,
  rules: Map<string, AffixRule>,
  words: string[]
): string[] {
  for (const entry of rule.entries) {
    if (!entry.match || entry.match.test(value)) {
      let next: string;

      if (entry.remove) {
        if (rule.type === "SFX") {
          // Suffix: remove from end of word
          if (value.endsWith(entry.remove)) {
            next = value.slice(0, -entry.remove.length) + entry.add;
          } else {
            continue; // Can't apply this rule
          }
        } else {
          // Prefix: remove from start of word
          if (value.startsWith(entry.remove)) {
            next = entry.add + value.slice(entry.remove.length);
          } else {
            continue; // Can't apply this rule
          }
        }
      } else {
        // No removal, just add
        next = rule.type === "SFX" ? value + entry.add : entry.add + value;
      }

      words.push(next);

      // Handle continuation rules
      if (entry.continuation && entry.continuation.length > 0) {
        for (const contFlag of entry.continuation) {
          const continuationRule = rules.get(contFlag);
          if (continuationRule) {
            apply(next, continuationRule, rules, words);
          }
        }
      }
    }
  }

  return words;
}

/**
 * Generate all word forms by applying all applicable affix rules
 *
 * @param word - The base word
 * @param flags - The flags associated with the word
 * @param rules - All available affix rules
 * @returns Array of all generated word forms
 */
export function generateForms(
  word: string,
  flags: string[],
  rules: Map<string, AffixRule>
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
            if (
              otherRule &&
              otherRule.combineable &&
              otherRule.type !== rule.type
            ) {
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
