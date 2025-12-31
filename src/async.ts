/**
 * Async loading utilities for @vandrite/nspell
 *
 * Provides non-blocking dictionary loading for browser environments.
 */

import { NSpell } from "./index";
import { toString, splitLines } from "./util";
import type { DictionaryInput, LoadOptions } from "./types";

/**
 * Load a dictionary asynchronously with progress reporting
 *
 * This function loads the dictionary in chunks, yielding to the event loop
 * between chunks to prevent UI freezing in browser environments.
 *
 * @example
 * ```ts
 * const spell = await loadAsync(
 *   { aff: affContent, dic: dicContent },
 *   { onProgress: (loaded, total) => console.log(`${loaded}/${total}`) }
 * );
 * ```
 */
export async function loadAsync(
  input: DictionaryInput,
  options: LoadOptions = {}
): Promise<NSpell> {
  const { onProgress, chunkSize = 10000 } = options;

  const affContent = toString(input.aff);

  if (!input.dic) {
    return new NSpell({ aff: affContent });
  }

  const dicContent = toString(input.dic);
  const lines = splitLines(dicContent);
  const total = lines.length;

  // Create spell checker with affix only
  const spell = new NSpell({ aff: affContent });

  // Load dictionary in chunks
  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunk = lines
      .slice(i, Math.min(i + chunkSize, lines.length))
      .join("\n");
    spell.dictionary(chunk);

    const loaded = Math.min(i + chunkSize, total);
    onProgress?.(loaded, total);

    // Yield to event loop
    await yieldToEventLoop();
  }

  return spell;
}

/**
 * Fetch and load a dictionary from URLs
 *
 * @example
 * ```ts
 * const spell = await loadFromUrl(
 *   'https://cdn.example.com/en.aff',
 *   'https://cdn.example.com/en.dic'
 * );
 * ```
 */
export async function loadFromUrl(
  affUrl: string,
  dicUrl?: string,
  options: LoadOptions = {}
): Promise<NSpell> {
  const [affResponse, dicResponse] = await Promise.all([
    fetch(affUrl),
    dicUrl ? fetch(dicUrl) : Promise.resolve(null),
  ]);

  if (!affResponse.ok) {
    throw new Error(`Failed to fetch affix file: ${affResponse.status}`);
  }

  const aff = await affResponse.text();
  const dic = dicResponse ? await dicResponse.text() : undefined;

  return loadAsync({ aff, dic }, options);
}

/**
 * Load multiple dictionaries and merge them
 *
 * @example
 * ```ts
 * const spell = await loadMultiple([
 *   { aff: enAff, dic: enDic },
 *   { dic: customTerms }  // Additional terms, uses first affix
 * ]);
 * ```
 */
export async function loadMultiple(
  inputs: DictionaryInput[],
  options: LoadOptions = {}
): Promise<NSpell> {
  if (inputs.length === 0) {
    throw new Error("At least one dictionary input is required");
  }

  const first = inputs[0];
  const spell = await loadAsync(first, options);

  // Add additional dictionaries
  for (let i = 1; i < inputs.length; i++) {
    if (inputs[i].dic) {
      const dicContent = toString(inputs[i].dic!);
      spell.dictionary(dicContent);
    }
  }

  return spell;
}

/**
 * Yield to the event loop to prevent UI freezing
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof setImmediate === "function") {
      setImmediate(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });
}

// Re-export types
export type { DictionaryInput, LoadOptions } from "./types";
