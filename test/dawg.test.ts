import { describe, it, expect, beforeEach } from 'vitest';
import { DAWG } from '../src/util/dawg';

describe('DAWG', () => {
  let dawg: DAWG;

  beforeEach(() => {
    dawg = new DAWG();
  });

  describe('add() and has()', () => {
    it('should add and find single words', () => {
      dawg.add('hello');
      expect(dawg.has('hello')).toBe(true);
      expect(dawg.has('world')).toBe(false);
    });

    it('should add multiple words', () => {
      dawg.add('cat');
      dawg.add('car');
      dawg.add('card');

      expect(dawg.has('cat')).toBe(true);
      expect(dawg.has('car')).toBe(true);
      expect(dawg.has('card')).toBe(true);
      expect(dawg.has('ca')).toBe(false); // prefix, not a word
    });

    it('should handle empty strings', () => {
      dawg.add('');
      expect(dawg.has('')).toBe(false);
      expect(dawg.size).toBe(0);
    });

    it('should share prefixes efficiently', () => {
      dawg.add('casa');
      dawg.add('casas');
      dawg.add('caso');
      dawg.add('casos');

      expect(dawg.has('casa')).toBe(true);
      expect(dawg.has('casas')).toBe(true);
      expect(dawg.has('caso')).toBe(true);
      expect(dawg.has('casos')).toBe(true);

      // Verify prefix sharing through stats
      const stats = dawg.getStats();
      expect(stats.words).toBe(4);
      // With prefix sharing, we should have fewer nodes than 4*5=20
      expect(stats.nodes).toBeLessThan(20);
    });

    it('should handle Unicode characters', () => {
      dawg.add('café');
      dawg.add('日本語');
      dawg.add('مرحبا');

      expect(dawg.has('café')).toBe(true);
      expect(dawg.has('日本語')).toBe(true);
      expect(dawg.has('مرحبا')).toBe(true);
    });
  });

  describe('flags', () => {
    it('should store and retrieve flags', () => {
      dawg.add('test', ['A', 'B']);
      expect(dawg.getFlags('test')).toEqual(['A', 'B']);
    });

    it('should return undefined for words without flags', () => {
      dawg.add('test');
      expect(dawg.getFlags('test')).toBeUndefined();
    });

    it('should return undefined for non-existent words', () => {
      expect(dawg.getFlags('nonexistent')).toBeUndefined();
    });

    it('should update flags on re-add', () => {
      dawg.add('test', ['A']);
      dawg.add('test', ['B', 'C']);
      expect(dawg.getFlags('test')).toEqual(['B', 'C']);
      expect(dawg.size).toBe(1); // Still just one word
    });
  });

  describe('remove()', () => {
    it('should remove existing words', () => {
      dawg.add('hello');
      dawg.add('world');

      expect(dawg.remove('hello')).toBe(true);
      expect(dawg.has('hello')).toBe(false);
      expect(dawg.has('world')).toBe(true);
      expect(dawg.size).toBe(1);
    });

    it('should return false for non-existent words', () => {
      expect(dawg.remove('nonexistent')).toBe(false);
    });

    it('should not affect other words sharing prefix', () => {
      dawg.add('car');
      dawg.add('card');

      dawg.remove('car');
      expect(dawg.has('car')).toBe(false);
      expect(dawg.has('card')).toBe(true);
    });
  });

  describe('hasPrefix()', () => {
    it('should detect prefixes', () => {
      dawg.add('testing');

      expect(dawg.hasPrefix('t')).toBe(true);
      expect(dawg.hasPrefix('te')).toBe(true);
      expect(dawg.hasPrefix('tes')).toBe(true);
      expect(dawg.hasPrefix('testing')).toBe(true);
      expect(dawg.hasPrefix('testingx')).toBe(false);
      expect(dawg.hasPrefix('x')).toBe(false);
    });
  });

  describe('getWordsWithPrefix()', () => {
    it('should return words with given prefix', () => {
      dawg.add('test');
      dawg.add('testing');
      dawg.add('tested');
      dawg.add('other');

      const words = [...dawg.getWordsWithPrefix('test')];
      expect(words).toContain('test');
      expect(words).toContain('testing');
      expect(words).toContain('tested');
      expect(words).not.toContain('other');
    });

    it('should respect maxResults limit', () => {
      for (let i = 0; i < 200; i++) {
        dawg.add(`word${i}`);
      }

      const words = [...dawg.getWordsWithPrefix('word', 10)];
      expect(words.length).toBe(10);
    });

    it('should return empty for non-existent prefix', () => {
      dawg.add('hello');
      const words = [...dawg.getWordsWithPrefix('xyz')];
      expect(words).toEqual([]);
    });
  });

  describe('words()', () => {
    it('should iterate all words', () => {
      dawg.add('a');
      dawg.add('b');
      dawg.add('c');

      const words = [...dawg.words()];
      expect(words).toHaveLength(3);
      expect(words).toContain('a');
      expect(words).toContain('b');
      expect(words).toContain('c');
    });
  });

  describe('clear()', () => {
    it('should remove all words', () => {
      dawg.add('a');
      dawg.add('b');
      dawg.clear();

      expect(dawg.size).toBe(0);
      expect(dawg.has('a')).toBe(false);
      expect(dawg.has('b')).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize correctly', () => {
      dawg.add('hello', ['A']);
      dawg.add('world', ['B', 'C']);
      dawg.add('test');

      const serialized = dawg.serialize();
      const restored = DAWG.deserialize(serialized);

      expect(restored.has('hello')).toBe(true);
      expect(restored.has('world')).toBe(true);
      expect(restored.has('test')).toBe(true);
      expect(restored.has('other')).toBe(false);

      expect(restored.getFlags('hello')).toEqual(['A']);
      expect(restored.getFlags('world')).toEqual(['B', 'C']);
      expect(restored.getFlags('test')).toBeUndefined();

      expect(restored.size).toBe(3);
    });

    it('should produce compact JSON', () => {
      dawg.add('cat');
      dawg.add('car');

      const serialized = JSON.stringify(dawg.serialize());
      // Should be reasonably compact
      expect(serialized.length).toBeLessThan(100);
    });
  });

  describe('getStats()', () => {
    it('should return accurate statistics', () => {
      dawg.add('a');
      dawg.add('ab');
      dawg.add('abc');

      const stats = dawg.getStats();
      expect(stats.words).toBe(3);
      expect(stats.nodes).toBe(4); // root + a + b + c
      expect(stats.avgDepth).toBe(2); // (1 + 2 + 3) / 3 = 2
    });
  });

  describe('performance', () => {
    it('should handle large dictionaries', () => {
      const words: string[] = [];
      for (let i = 0; i < 10000; i++) {
        words.push(`word${i.toString().padStart(5, '0')}`);
      }

      const startAdd = performance.now();
      for (const word of words) {
        dawg.add(word);
      }
      const addTime = performance.now() - startAdd;

      expect(dawg.size).toBe(10000);
      expect(addTime).toBeLessThan(1000); // Should be fast

      const startLookup = performance.now();
      for (const word of words) {
        dawg.has(word);
      }
      const lookupTime = performance.now() - startLookup;

      expect(lookupTime).toBeLessThan(100); // Lookups should be very fast
    });
  });
});
