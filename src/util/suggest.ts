/**
 * Spelling suggestions with multi-strategy candidate generation
 */

import type { AffixData, AffixFlags } from '../types';
import { DAWG } from './dawg';
import { normalize, denormalize, detectCasing } from './index';
import { phoneticSimilarity } from './phonetics';
import { generateKeyboardEdits, calculateKeyboardScore, generateSwapEdits } from './keyboard';
import { getWeights, calculateWeightedScore } from './weights';
import { getFrequencyScore } from './frequency';

/**
 * Suggestion with scoring details
 */
interface ScoredSuggestion {
  word: string;
  scores: {
    editDistance: number;
    ngram: number;
    phonetic: number;
    frequency: number;
    keyboard: number;
  };
  finalScore: number;
}

/**
 * Get equivalent characters from dictionary MAP groups
 */
function getMapEquivalents(char: string, mapGroups: string[]): string[] {
  const lower = char.toLowerCase();
  const equivalents: string[] = [];

  for (const group of mapGroups) {
    const lowerGroup = group.toLowerCase();
    if (lowerGroup.includes(lower)) {
      for (const c of group) {
        if (c.toLowerCase() !== lower) {
          equivalents.push(c.toLowerCase());
        }
      }
    }
  }

  return equivalents;
}

/**
 * Generate n-grams (character sequences) from a word
 */
function generateNgrams(word: string, n: number = 2): Set<string> {
  const ngrams = new Set<string>();
  const lower = word.toLowerCase();
  for (let i = 0; i <= lower.length - n; i++) {
    ngrams.add(lower.slice(i, i + n));
  }
  return ngrams;
}

/**
 * Calculate n-gram similarity score between two words (Dice coefficient)
 */
function ngramSimilarity(word1: string, word2: string, n: number = 2): number {
  const ngrams1 = generateNgrams(word1, n);
  const ngrams2 = generateNgrams(word2, n);

  if (ngrams1.size === 0 || ngrams2.size === 0) return 0;

  let intersection = 0;
  for (const ng of ngrams1) {
    if (ngrams2.has(ng)) intersection++;
  }

  return (2 * intersection) / (ngrams1.size + ngrams2.size);
}

/**
 * Calculate common prefix length between two words
 */
function commonPrefixLength(a: string, b: string): number {
  const lower1 = a.toLowerCase();
  const lower2 = b.toLowerCase();
  let i = 0;
  while (i < lower1.length && i < lower2.length && lower1[i] === lower2[i]) {
    i++;
  }
  return i;
}

/**
 * Calculate edit distance score (0-1, higher = more similar)
 */
function editDistanceScore(word1: string, word2: string): number {
  const len1 = word1.length;
  const len2 = word2.length;
  const maxLen = Math.max(len1, len2);

  if (maxLen === 0) return 1;

  // Simple Levenshtein approximation for scoring
  const prefixLen = commonPrefixLength(word1, word2);
  const lengthDiff = Math.abs(len1 - len2);

  // Approximate score based on prefix match and length similarity
  const prefixScore = prefixLen / maxLen;
  const lengthScore = 1 - lengthDiff / maxLen;

  return prefixScore * 0.6 + lengthScore * 0.4;
}

interface SuggestMemory {
  state: Map<string, boolean>;
  candidates: Set<string>;
}

/**
 * Get spelling suggestions for a word
 *
 * @param dawg - The DAWG dictionary
 * @param affixData - Affix rules and data
 * @param compoundRules - Compiled compound rules
 * @param value - The word to get suggestions for
 * @param correctFn - Function to check if a word is correct
 * @param langCode - Language code for weight selection (default: 'en')
 */
export function suggest(
  dawg: DAWG,
  affixData: AffixData,
  _compoundRules: RegExp[],
  value: string,
  correctFn: (word: string) => boolean,
  langCode: string = 'en',
): string[] {
  // Normalize input
  const normalized = normalize(value.trim(), affixData.conversion.in);

  if (!normalized || correctFn(normalized)) {
    return [];
  }

  const currentCase = detectCasing(normalized);
  const weights = getWeights(langCode);

  // Memory to track processed candidates
  const memory: SuggestMemory = {
    state: new Map(),
    candidates: new Set(),
  };

  // Generate candidates

  const rawCandidates: string[] = [];

  // Strategy 1: Replacement table lookups
  for (const [from, to] of affixData.replacementTable) {
    let offset = normalized.indexOf(from);
    while (offset > -1) {
      rawCandidates.push(normalized.slice(0, offset) + to + normalized.slice(offset + from.length));
      offset = normalized.indexOf(from, offset + 1);
    }
  }

  // Strategy 2: Keyboard proximity (from affix KEY groups)
  for (let i = 0; i < normalized.length; i++) {
    const character = normalized.charAt(i);
    const before = normalized.slice(0, i);
    const after = normalized.slice(i + 1);
    const insensitive = character.toLowerCase();
    const upper = insensitive !== character;
    const localCharAdded: Record<string, boolean> = {};

    for (const group of affixData.flags.KEY) {
      const position = group.indexOf(insensitive);
      if (position < 0) continue;

      for (let j = 0; j < group.length; j++) {
        if (j !== position) {
          let otherCharacter = group.charAt(j);
          if (localCharAdded[otherCharacter]) continue;
          localCharAdded[otherCharacter] = true;

          if (upper) {
            otherCharacter = otherCharacter.toUpperCase();
          }
          rawCandidates.push(before + otherCharacter + after);
        }
      }
    }
  }

  // Strategy 3: QWERTY keyboard edits (new)
  rawCandidates.push(...generateKeyboardEdits(normalized));
  rawCandidates.push(...generateSwapEdits(normalized));

  // Strategy 4: MAP equivalents (character equivalences from affix)
  if (affixData.flags.MAP.length > 0) {
    for (let i = 0; i < normalized.length; i++) {
      const character = normalized.charAt(i);
      const before = normalized.slice(0, i);
      const after = normalized.slice(i + 1);
      const lower = character.toLowerCase();
      const upper = lower !== character;

      const variants = getMapEquivalents(character, affixData.flags.MAP);
      for (const variant of variants) {
        const replacementChar = upper ? variant.toUpperCase() : variant;
        rawCandidates.push(before + replacementChar + after);
      }
    }
  }

  // Strategy 5: Double/missing character detection
  let nextCharacter = normalized.charAt(0);
  let values: string[] = [''];
  let max = 1;
  let distance = 0;

  for (let i = 0; i < normalized.length; i++) {
    const character = nextCharacter;
    nextCharacter = normalized.charAt(i + 1);

    const replacement = character === nextCharacter ? '' : character + character;
    const count = values.length;

    for (let j = 0; j < count; j++) {
      if (j <= max) {
        values.push(values[j] + replacement);
      }
      values[j] += character;
    }

    if (++distance < 3) {
      max = values.length;
    }
  }
  rawCandidates.push(...values);

  // Strategy 6: Case variations
  values = [normalized];
  let replacement = normalized.toLowerCase();
  if (normalized === replacement || currentCase === null) {
    values.push(normalized.charAt(0).toUpperCase() + replacement.slice(1));
  }
  replacement = normalized.toUpperCase();
  if (normalized !== replacement) {
    values.push(replacement);
  }

  // Strategy 7: Prefix-based suggestions from DAWG (new)
  // Use the first N characters as prefix to find similar words
  const minPrefixLen = Math.max(1, Math.floor(normalized.length * 0.5));
  for (let prefixLen = normalized.length - 1; prefixLen >= minPrefixLen; prefixLen--) {
    const prefix = normalized.slice(0, prefixLen).toLowerCase();
    const prefixMatches = dawg.getPrefixMatches(prefix, 20);
    for (const match of prefixMatches) {
      rawCandidates.push(match.word);
    }
  }

  // Validate candidates

  const validCandidates: string[] = [];

  for (const candidate of rawCandidates) {
    if (memory.state.has(candidate)) {
      if (memory.state.get(candidate)) {
        memory.candidates.add(candidate);
      }
      continue;
    }

    // Check if valid word
    let isValid = false;
    const lower = candidate.toLowerCase();

    if (dawg.has(candidate)) {
      isValid = !hasNoSuggestFlag(dawg, affixData.flags, candidate);
    } else if (lower !== candidate && dawg.has(lower)) {
      isValid = !hasNoSuggestFlag(dawg, affixData.flags, lower);
    }

    memory.state.set(candidate, isValid);

    if (isValid) {
      validCandidates.push(candidate);
      memory.candidates.add(candidate);
    }
  }

  // Edit distance 1

  const characters = affixData.flags.TRY;
  const editDistance1: string[] = [];

  for (const word of values) {
    let before = '';
    let character = '';
    let nextChar = word.charAt(0);
    let nextAfter = word;
    let nextNextAfter = word.slice(1);
    let nextUpper = nextChar.toLowerCase() !== nextChar;
    const wordCase = detectCasing(word);

    for (let position = 0; position <= word.length; position++) {
      before += character;
      const after = nextAfter;
      nextAfter = nextNextAfter;
      nextNextAfter = nextAfter.slice(1);
      character = nextChar;
      nextChar = word.charAt(position + 1);
      const upper = nextUpper;

      if (nextChar) {
        nextUpper = nextChar.toLowerCase() !== nextChar;
      }

      // Case switching edits
      if (nextAfter && upper !== nextUpper) {
        checkAndAdd(before + switchCase(nextAfter));
        checkAndAdd(before + switchCase(nextChar) + switchCase(character) + nextNextAfter);
      }

      // Remove
      checkAndAdd(before + nextAfter);

      // Switch adjacent
      if (nextAfter) {
        checkAndAdd(before + nextChar + character + nextNextAfter);
      }

      // Try all characters
      for (const inject of characters) {
        const injectUpper = inject.toUpperCase();

        if (upper && inject !== injectUpper) {
          if (wordCase !== 'lower') {
            checkAndAdd(before + inject + after);
            checkAndAdd(before + inject + nextAfter);
          }
          checkAndAdd(before + injectUpper + after);
          checkAndAdd(before + injectUpper + nextAfter);
        } else {
          checkAndAdd(before + inject + after);
          checkAndAdd(before + inject + nextAfter);
        }
      }
    }
  }

  function checkAndAdd(value: string): void {
    if (memory.state.has(value)) {
      if (memory.state.get(value)) memory.candidates.add(value);
      return;
    }

    editDistance1.push(value);

    let isValid = false;
    const lower = value.toLowerCase();

    if (dawg.has(value)) {
      isValid = !hasNoSuggestFlag(dawg, affixData.flags, value);
    } else if (lower !== value && dawg.has(lower)) {
      isValid = !hasNoSuggestFlag(dawg, affixData.flags, lower);
    }

    memory.state.set(value, isValid);

    if (isValid) {
      validCandidates.push(value);
      memory.candidates.add(value);
    }
  }

  function switchCase(fragment: string): string {
    const first = fragment.charAt(0);
    return (
      (first.toLowerCase() === first ? first.toUpperCase() : first.toLowerCase()) +
      fragment.slice(1)
    );
  }

  // Early exit if we have enough suggestions
  const MIN_GOOD_SUGGESTIONS = 5;
  const TARGET_SUGGESTIONS = 10;

  // Edit distance 2 (if needed)

  if (validCandidates.length < MIN_GOOD_SUGGESTIONS) {
    let previous = 0;
    const maxIterations = Math.min(
      editDistance1.length,
      Math.pow(Math.max(15 - normalized.length, 3), 3),
    );
    const batchSize = Math.max(Math.pow(10 - normalized.length, 3), 1);

    while (validCandidates.length < TARGET_SUGGESTIONS && previous < maxIterations) {
      const next = previous + batchSize;
      const batch = editDistance1.slice(previous, next);

      for (const word of batch) {
        // Generate simple edits for distance 2
        for (let i = 0; i < word.length; i++) {
          checkAndAdd(word.slice(0, i) + word.slice(i + 1)); // delete
        }
      }

      previous = next;
      if (validCandidates.length >= MIN_GOOD_SUGGESTIONS) break;
    }
  }

  // Score and rank

  const scoredSuggestions: ScoredSuggestion[] = [];

  for (const word of memory.candidates) {
    const scores = {
      editDistance: editDistanceScore(normalized, word),
      ngram: ngramSimilarity(normalized, word),
      phonetic: phoneticSimilarity(normalized, word),
      frequency: getFrequencyScore(word, langCode),
      keyboard: calculateKeyboardScore(normalized, word),
    };

    const finalScore = calculateWeightedScore(scores, weights);

    scoredSuggestions.push({ word, scores, finalScore });
  }

  // Sort by final score (descending)
  scoredSuggestions.sort((a, b) => {
    if (Math.abs(a.finalScore - b.finalScore) > 0.01) {
      return b.finalScore - a.finalScore;
    }

    // Tie-breakers
    // Prefer same length
    const lenDiffA = Math.abs(a.word.length - normalized.length);
    const lenDiffB = Math.abs(b.word.length - normalized.length);
    if (lenDiffA !== lenDiffB) return lenDiffA - lenDiffB;

    // Prefer matching case
    const casingA = detectCasing(a.word);
    const casingB = detectCasing(b.word);
    if (casingA === currentCase && casingB !== currentCase) return -1;
    if (casingB === currentCase && casingA !== currentCase) return 1;

    // Alphabetical
    return a.word.localeCompare(b.word);
  });

  // Normalize output

  const result: string[] = [];
  const normalizedSet = new Set<string>();

  for (const suggestion of scoredSuggestions) {
    const output = denormalize(suggestion.word, affixData.conversion.out);
    const lower = output.toLowerCase();

    if (!normalizedSet.has(lower)) {
      result.push(output);
      normalizedSet.add(lower);

      if (result.length >= 10) break;
    }
  }

  return result;
}

/**
 * Check if a word has the NOSUGGEST flag
 */
function hasNoSuggestFlag(dawg: DAWG, flags: AffixFlags, word: string): boolean {
  if (!flags.NOSUGGEST) return false;
  const wordFlags = dawg.getFlags(word);
  return wordFlags !== undefined && wordFlags.includes(flags.NOSUGGEST);
}
