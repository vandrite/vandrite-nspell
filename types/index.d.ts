/**
 * Type declarations for @vandrite/nspell
 *
 * A modern Hunspell-compatible spell checker with DAWG-based storage for memory efficiency.
 */

declare module '@vandrite/nspell' {
  interface NSpellOptions {
    aff: string | Buffer;
    dic?: string | Buffer;
  }

  interface SpellResult {
    correct: boolean;
    forbidden: boolean;
    warn: boolean;
  }

  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string, model?: string): this;
    remove(word: string): this;
    wordCharacters(): string | null;
    spell(word: string): SpellResult;
    dictionary(dic: string | Buffer): this;
    personal(dic: string | Buffer): this;
    getStats(): { words: number; nodes: number; avgDepth: number };
  }

  function nspell(options: NSpellOptions): NSpell;
  function nspell(aff: string | Buffer, dic?: string | Buffer): NSpell;

  export = nspell;
}
