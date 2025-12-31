/**
 * Suggest algorithm for spelling suggestions
 *
 * Implements the full nspell suggest algorithm with:
 * - Replacement table lookups
 * - Keyboard proximity edits
 * - Double/missing character detection
 * - Edit distance 1 and 2
 * - Weighted sorting
 */

import type { AffixData, AffixFlags } from "../types";
import { DAWG } from "./dawg";
import { normalize, denormalize, detectCasing } from "./index";
import { form } from "./form";

interface SuggestMemory {
  state: Map<string, boolean>;
  weighted: Map<string, number>;
  suggestions: string[];
}

/**
 * Get spelling suggestions for a word
 */
export function suggest(
  dawg: DAWG,
  affixData: AffixData,
  compoundRules: RegExp[],
  value: string,
  correctFn: (word: string) => boolean
): string[] {
  const suggestions: string[] = [];
  const weighted = new Map<string, number>();
  const edits: string[] = [];

  // Normalize input
  const normalized = normalize(value.trim(), affixData.conversion.in);

  if (!normalized || correctFn(normalized)) {
    return [];
  }

  const currentCase = detectCasing(normalized);

  // 1. Check the replacement table
  for (const [from, to] of affixData.replacementTable) {
    let offset = normalized.indexOf(from);
    while (offset > -1) {
      edits.push(
        normalized.slice(0, offset) +
          to +
          normalized.slice(offset + from.length)
      );
      offset = normalized.indexOf(from, offset + 1);
    }
  }

  // 2. Check keyboard proximity
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

          edits.push(before + otherCharacter + after);
        }
      }
    }
  }

  // 3. Double/missing character detection (up to 3 distances)
  let nextCharacter = normalized.charAt(0);
  let values: string[] = [""];
  let max = 1;
  let distance = 0;

  for (let i = 0; i < normalized.length; i++) {
    const character = nextCharacter;
    nextCharacter = normalized.charAt(i + 1);

    const replacement =
      character === nextCharacter ? "" : character + character;
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

  edits.push(...values);

  // 4. Ensure capitalized and uppercase values are included
  values = [normalized];
  let replacement = normalized.toLowerCase();

  if (normalized === replacement || currentCase === null) {
    values.push(normalized.charAt(0).toUpperCase() + replacement.slice(1));
  }

  replacement = normalized.toUpperCase();
  if (normalized !== replacement) {
    values.push(replacement);
  }

  // 5. Generate suggestions with edit distance 1
  const memory: SuggestMemory = {
    state: new Map(),
    weighted,
    suggestions,
  };

  const firstLevel = generate(
    dawg,
    affixData,
    compoundRules,
    correctFn,
    memory,
    values,
    edits
  );

  // 6. If no suggestions, try edit distance 2 in batches
  let previous = 0;
  const maxIterations = Math.min(
    firstLevel.length,
    Math.pow(Math.max(15 - normalized.length, 3), 3)
  );
  const batchSize = Math.max(Math.pow(10 - normalized.length, 3), 1);

  while (!suggestions.length && previous < maxIterations) {
    const next = previous + batchSize;
    generate(
      dawg,
      affixData,
      compoundRules,
      correctFn,
      memory,
      firstLevel.slice(previous, next)
    );
    previous = next;
  }

  // 7. Sort suggestions by weight
  suggestions.sort((a, b) => {
    // Weight
    const weightA = weighted.get(a) || 0;
    const weightB = weighted.get(b) || 0;
    if (weightA !== weightB) return weightB - weightA;

    // Casing match
    const casingA = detectCasing(a);
    const casingB = detectCasing(b);
    if (casingA === currentCase && casingB !== currentCase) return -1;
    if (casingB === currentCase && casingA !== currentCase) return 1;

    // Alphabetical
    return a.localeCompare(b);
  });

  // 8. Normalize output and remove duplicates
  const result: string[] = [];
  const normalizedSet = new Set<string>();

  for (const suggestion of suggestions) {
    const output = denormalize(suggestion, affixData.conversion.out);
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
 * Generate candidates with various edits
 */
function generate(
  dawg: DAWG,
  affixData: AffixData,
  _compoundRules: RegExp[],
  _correctFn: (word: string) => boolean,
  memory: SuggestMemory,
  words: string[],
  edits?: string[]
): string[] {
  const characters = affixData.flags.TRY;
  const result: string[] = [];

  // Check pre-generated edits
  if (edits) {
    for (const edit of edits) {
      check(edit, true);
    }
  }

  // Iterate over each word
  for (const word of words) {
    let before = "";
    let character = "";
    let nextCharacter = word.charAt(0);
    let nextAfter = word;
    let nextNextAfter = word.slice(1);
    let nextUpper = nextCharacter.toLowerCase() !== nextCharacter;
    const currentCase = detectCasing(word);

    // Iterate over every character (including end position)
    for (let position = 0; position <= word.length; position++) {
      before += character;
      const after = nextAfter;
      nextAfter = nextNextAfter;
      nextNextAfter = nextAfter.slice(1);
      character = nextCharacter;
      nextCharacter = word.charAt(position + 1);
      const upper = nextUpper;

      if (nextCharacter) {
        nextUpper = nextCharacter.toLowerCase() !== nextCharacter;
      }

      // Case switching edits
      if (nextAfter && upper !== nextUpper) {
        check(before + switchCase(nextAfter));
        check(
          before +
            switchCase(nextCharacter) +
            switchCase(character) +
            nextNextAfter
        );
      }

      // Remove
      check(before + nextAfter);

      // Switch adjacent
      if (nextAfter) {
        check(before + nextCharacter + character + nextNextAfter);
      }

      // Try all characters
      for (const inject of characters) {
        const injectUpper = inject.toUpperCase();

        if (upper && inject !== injectUpper) {
          if (currentCase !== "lower") {
            check(before + inject + after);
            check(before + inject + nextAfter);
          }

          check(before + injectUpper + after);
          check(before + injectUpper + nextAfter);
        } else {
          check(before + inject + after);
          check(before + inject + nextAfter);
        }
      }
    }
  }

  return result;

  function check(value: string, double: boolean = false): void {
    if (memory.state.has(value)) {
      if (memory.state.get(value)) {
        memory.weighted.set(value, (memory.weighted.get(value) || 0) + 1);
      }
      return;
    }

    result.push(value);

    // Find the corrected form
    const corrected = form(
      dawg,
      affixData.flags,
      affixData.conversion.in,
      value,
      false
    );

    const isValid =
      corrected !== null && !hasNoSuggestFlag(dawg, affixData.flags, corrected);

    memory.state.set(value, isValid);

    if (isValid) {
      memory.weighted.set(value, double ? 10 : 0);
      memory.suggestions.push(value);
    }
  }

  function switchCase(fragment: string): string {
    const first = fragment.charAt(0);
    return (
      (first.toLowerCase() === first
        ? first.toUpperCase()
        : first.toLowerCase()) + fragment.slice(1)
    );
  }
}

/**
 * Check if a word has the NOSUGGEST flag
 */
function hasNoSuggestFlag(
  dawg: DAWG,
  flags: AffixFlags,
  word: string
): boolean {
  if (!flags.NOSUGGEST) return false;
  const wordFlags = dawg.getFlags(word);
  return wordFlags !== undefined && wordFlags.includes(flags.NOSUGGEST);
}
