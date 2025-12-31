/**
 * Type definitions for @vandrite/nspell
 */

// ============================================================================
// DAWG Types
// ============================================================================

/**
 * DAWG node structure for efficient word storage
 */
export interface DAWGNode {
  /** Child nodes indexed by character */
  children: Map<string, DAWGNode>;
  /** Whether this node marks the end of a word */
  isEnd: boolean;
  /** Flags associated with this word (only if isEnd is true) */
  flags?: string[];
}

/**
 * Serialized DAWG node for JSON export
 */
export interface SerializedDAWGNode {
  c?: Record<string, SerializedDAWGNode>; // children
  e?: 1; // isEnd (only present if true)
  f?: string[]; // flags
}

// ============================================================================
// Affix Types
// ============================================================================

/**
 * Affix rule entry - defines a single transformation
 */
export interface AffixEntry {
  /** Characters to add */
  add: string;
  /** Characters/pattern to remove (string or regex) */
  remove: string;
  /** Condition pattern that must match (string or regex) */
  match: RegExp | null;
  /** Continuation flags for chaining rules */
  continuation: string[];
}

/**
 * Affix rule (prefix or suffix)
 */
export interface AffixRule {
  /** Rule type: prefix or suffix */
  type: 'PFX' | 'SFX';
  /** Whether this rule can combine with others */
  combineable: boolean;
  /** List of transformation entries */
  entries: AffixEntry[];
}

/**
 * Parsed affix data structure
 */
export interface AffixData {
  /** Compound rule code storage */
  compoundRuleCodes: Map<string, string[]>;
  /** Replacement table for suggestions [from, to] */
  replacementTable: [string, string][];
  /** Input/output conversion rules */
  conversion: {
    in: [RegExp, string][];
    out: [RegExp, string][];
  };
  /** Compound word rule patterns */
  compoundRules: string[];
  /** Affix rules indexed by flag */
  rules: Map<string, AffixRule>;
  /** General affix flags and settings */
  flags: AffixFlags;
}

/**
 * Affix flags from the .aff file
 */
export interface AffixFlags {
  /** Flag encoding type */
  FLAG?: 'short' | 'long' | 'num' | 'UTF-8';
  /** Keyboard layout for suggestions */
  KEY: string[];
  /** Characters to try for suggestions */
  TRY: string[];
  /** Character equivalence groups for suggestions (MAP) */
  MAP: string[];
  /** Flag for words to exclude from suggestions */
  NOSUGGEST?: string;
  /** Flag for warning words */
  WARN?: string;
  /** Flag for forbidden words */
  FORBIDDENWORD?: string;
  /** Flag for keep-case words */
  KEEPCASE?: string;
  /** Minimum compound word length */
  COMPOUNDMIN: number;
  /** Flag for compound-only words */
  ONLYINCOMPOUND?: string;
  /** Flag for words that need an affix */
  NEEDAFFIX?: string;
  /** Valid word characters */
  WORDCHARS?: string;
  /** Whether to forbid warnings */
  FORBIDWARN?: boolean;
  /** Compound flag */
  COMPOUNDFLAG?: string;
  /** Compound begin flag */
  COMPOUNDBEGIN?: string;
  /** Compound middle flag */
  COMPOUNDMIDDLE?: string;
  /** Compound end flag */
  COMPOUNDLAST?: string;
  /** Allow any additional flags */
  [key: string]: unknown;
}

// ============================================================================
// Spell Result Types
// ============================================================================

/**
 * Detailed spell check result
 */
export interface SpellResult {
  /** Whether the word is spelled correctly */
  correct: boolean;
  /** Whether the word is forbidden */
  forbidden: boolean;
  /** Whether the word triggers a warning */
  warn: boolean;
}

// ============================================================================
// Input Types
// ============================================================================

/**
 * Dictionary input object with aff and optional dic
 */
export interface DictionaryInput {
  /** Affix file content */
  aff: string | Uint8Array | ArrayBuffer;
  /** Dictionary file content */
  dic?: string | Uint8Array | ArrayBuffer;
}

/**
 * Valid input types for NSpell constructor
 */
export type NSpellInput = DictionaryInput | DictionaryInput[] | string | Uint8Array | ArrayBuffer;

// ============================================================================
// Async Loading Types
// ============================================================================

/**
 * Options for async dictionary loading
 */
export interface LoadOptions {
  /** Progress callback (loaded lines, total lines) */
  onProgress?: (loaded: number, total: number) => void;
  /** Number of lines to process per chunk */
  chunkSize?: number;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Word with its associated flags
 */
export interface WordEntry {
  word: string;
  flags: string[];
}

/**
 * Casing type for a word
 */
export type CasingType = 'lower' | 'upper' | 'capitalized' | 'mixed' | null;
