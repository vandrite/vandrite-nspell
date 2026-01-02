/**
 * Language-specific scoring weights for suggestion ranking
 */

export interface ScoringWeights {
  editDistance: number;
  ngram: number;
  phonetic: number;
  frequency: number;
  keyboard: number;
}

/**
 * Default weights for languages without specific configuration
 */
export const DEFAULT_WEIGHTS: ScoringWeights = {
  editDistance: 0.35,
  ngram: 0.25,
  phonetic: 0.15,
  frequency: 0.15,
  keyboard: 0.1,
};

/**
 * Language-specific weight configurations
 */
export const LANGUAGE_WEIGHTS: Record<string, ScoringWeights> = {
  // English: Higher phonetic weight due to irregular spelling
  en: {
    editDistance: 0.3,
    ngram: 0.25,
    phonetic: 0.25,
    frequency: 0.1,
    keyboard: 0.1,
  },

  // Portuguese: Higher ngram weight, moderate phonetic
  pt: {
    editDistance: 0.3,
    ngram: 0.3,
    phonetic: 0.2,
    frequency: 0.1,
    keyboard: 0.1,
  },

  // Spanish: Similar to Portuguese
  es: {
    editDistance: 0.3,
    ngram: 0.3,
    phonetic: 0.2,
    frequency: 0.1,
    keyboard: 0.1,
  },

  // German: Compound words make edit distance more important
  de: {
    editDistance: 0.4,
    ngram: 0.25,
    phonetic: 0.15,
    frequency: 0.1,
    keyboard: 0.1,
  },

  // French: Complex spelling needs higher phonetic weight
  fr: {
    editDistance: 0.25,
    ngram: 0.25,
    phonetic: 0.3,
    frequency: 0.1,
    keyboard: 0.1,
  },

  // Italian: Regular spelling, lower phonetic weight
  it: {
    editDistance: 0.35,
    ngram: 0.3,
    phonetic: 0.15,
    frequency: 0.1,
    keyboard: 0.1,
  },
};

/**
 * Get weights for a specific language code
 * Falls back to default weights if language not found
 */
export function getWeights(langCode: string): ScoringWeights {
  // Normalize language code (e.g., "pt-BR" -> "pt")
  const baseLang = langCode.split('-')[0].toLowerCase();
  return LANGUAGE_WEIGHTS[baseLang] || DEFAULT_WEIGHTS;
}

/**
 * Calculate final weighted score from individual scores
 */
export function calculateWeightedScore(
  scores: {
    editDistance: number;
    ngram: number;
    phonetic: number;
    frequency: number;
    keyboard: number;
  },
  weights: ScoringWeights,
): number {
  return (
    scores.editDistance * weights.editDistance +
    scores.ngram * weights.ngram +
    scores.phonetic * weights.phonetic +
    scores.frequency * weights.frequency +
    scores.keyboard * weights.keyboard
  );
}
