/**
 * Form finding utilities
 *
 * Find known forms of words considering casing and normalization.
 */

import type { AffixFlags } from '../types';
import { DAWG } from './dawg';
import { normalize, hasFlag } from './index';

/**
 * Find a known form of a word in the dictionary
 *
 * @param dawg - The DAWG containing words
 * @param flags - Affix flags configuration
 * @param conversion - Input conversion rules
 * @param value - The word to find
 * @param all - If true, include forbidden words
 * @returns The normalized form if found, null otherwise
 */
export function form(
  dawg: DAWG,
  flags: AffixFlags,
  conversion: [RegExp, string][],
  value: string,
  all: boolean = false,
): string | null {
  let normal = value.trim();

  if (!normal) {
    return null;
  }

  normal = normalize(normal, conversion);

  // Check exact match
  if (dawg.has(normal)) {
    const wordFlags = dawg.getFlags(normal);
    if (!all && hasFlag(wordFlags, flags.FORBIDDENWORD)) {
      return null;
    }
    // Check ONLYINCOMPOUND
    if (hasFlag(wordFlags, flags.ONLYINCOMPOUND)) {
      return null;
    }
    return normal;
  }

  // Try sentence case if the value is uppercase
  if (normal.toUpperCase() === normal) {
    const alternative = normal.charAt(0) + normal.slice(1).toLowerCase();

    if (!shouldIgnore(dawg, flags, alternative, all)) {
      if (dawg.has(alternative)) {
        return alternative;
      }
    }
  }

  // Try lowercase
  const lower = normal.toLowerCase();

  if (lower !== normal) {
    if (!shouldIgnore(dawg, flags, lower, all)) {
      if (dawg.has(lower)) {
        return lower;
      }
    }
  }

  return null;
}

/**
 * Check if a word should be ignored in form finding
 */
function shouldIgnore(dawg: DAWG, flags: AffixFlags, word: string, all: boolean): boolean {
  const wordFlags = dawg.getFlags(word);
  return hasFlag(wordFlags, flags.KEEPCASE) || (!all && hasFlag(wordFlags, flags.FORBIDDENWORD));
}

/**
 * Check if a word exists exactly in the dictionary (for compound checking)
 */
export function exact(
  dawg: DAWG,
  flags: AffixFlags,
  compoundRules: RegExp[],
  value: string,
): boolean {
  if (dawg.has(value)) {
    const wordFlags = dawg.getFlags(value);
    return !hasFlag(wordFlags, flags.ONLYINCOMPOUND);
  }

  // Check if this might be a compound word
  if (value.length >= flags.COMPOUNDMIN) {
    for (const rule of compoundRules) {
      if (rule.test(value)) {
        return true;
      }
    }
  }

  return false;
}
