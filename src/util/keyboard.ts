/**
 * Keyboard proximity utilities for spelling suggestions
 */

/**
 * QWERTY keyboard layout adjacency map
 * Each key maps to its physically adjacent keys
 */
const QWERTY_ADJACENCY: Record<string, string> = {
  // Row 1
  q: 'wa',
  w: 'qeasd',
  e: 'wrsdf',
  r: 'etdfg',
  t: 'ryfgh',
  y: 'tughj',
  u: 'yihjk',
  i: 'uojkl',
  o: 'ipkl',
  p: 'ol',

  // Row 2
  a: 'qwsz',
  s: 'awedxz',
  d: 'serfcx',
  f: 'drtgvc',
  g: 'ftyhbv',
  h: 'gyujnb',
  j: 'huikmn',
  k: 'jiolm',
  l: 'kop',

  // Row 3
  z: 'asx',
  x: 'zsdc',
  c: 'xdfv',
  v: 'cfgb',
  b: 'vghn',
  n: 'bhjm',
  m: 'njk',
};

/**
 * Brazilian Portuguese keyboard (ABNT2) specific adjacency extensions
 * Includes accented characters common in Portuguese
 */
const ABNT2_EXTENSIONS: Record<string, string> = {
  ç: 'lk',
  á: 'a',
  à: 'a',
  ã: 'a',
  â: 'a',
  é: 'e',
  ê: 'e',
  í: 'i',
  ó: 'o',
  ô: 'o',
  õ: 'o',
  ú: 'u',
  ü: 'u',
};

/**
 * Get adjacent keys for a given character
 */
export function getAdjacentKeys(char: string): string[] {
  const lower = char.toLowerCase();
  const adjacents = QWERTY_ADJACENCY[lower] || ABNT2_EXTENSIONS[lower] || '';
  return adjacents.split('');
}

/**
 * Calculate keyboard distance between two characters
 * Returns 0 for same key, 1 for adjacent keys, 2 for non-adjacent
 */
export function keyboardDistance(char1: string, char2: string): number {
  const lower1 = char1.toLowerCase();
  const lower2 = char2.toLowerCase();

  if (lower1 === lower2) return 0;

  const adjacents = getAdjacentKeys(lower1);
  if (adjacents.includes(lower2)) return 1;

  return 2;
}

/**
 * Calculate total keyboard distance score for a word transformation
 * Lower score = more likely to be a keyboard typo
 */
export function calculateKeyboardScore(original: string, suggestion: string): number {
  const lower1 = original.toLowerCase();
  const lower2 = suggestion.toLowerCase();

  // Handle different lengths
  if (Math.abs(lower1.length - lower2.length) > 2) {
    return 0; // Too different
  }

  let totalDistance = 0;
  let comparisons = 0;
  const minLen = Math.min(lower1.length, lower2.length);

  for (let i = 0; i < minLen; i++) {
    if (lower1[i] !== lower2[i]) {
      const dist = keyboardDistance(lower1[i], lower2[i]);
      if (dist === 1) {
        totalDistance += 1;
      } else {
        totalDistance += 2;
      }
    }
    comparisons++;
  }

  // Penalize length differences
  totalDistance += Math.abs(lower1.length - lower2.length);

  if (comparisons === 0) return 1;

  // Convert to 0-1 score (higher = more similar)
  const maxPossibleDistance = comparisons * 2 + 2;
  return Math.max(0, 1 - totalDistance / maxPossibleDistance);
}

/**
 * Generate edit candidates based on keyboard proximity
 * Replaces each character with its adjacent keys
 */
export function generateKeyboardEdits(word: string): string[] {
  const edits: string[] = [];
  const lower = word.toLowerCase();

  for (let i = 0; i < lower.length; i++) {
    const before = lower.slice(0, i);
    const after = lower.slice(i + 1);
    const adjacents = getAdjacentKeys(lower[i]);

    for (const adj of adjacents) {
      edits.push(before + adj + after);
    }
  }

  return edits;
}

/**
 * Generate swapped adjacent character edits
 * For typos where two keys were pressed in wrong order
 */
export function generateSwapEdits(word: string): string[] {
  const edits: string[] = [];
  const lower = word.toLowerCase();

  for (let i = 0; i < lower.length - 1; i++) {
    const swapped = lower.slice(0, i) + lower[i + 1] + lower[i] + lower.slice(i + 2);
    edits.push(swapped);
  }

  return edits;
}
