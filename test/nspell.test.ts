import { describe, it, expect, beforeEach } from "vitest";
import { NSpell } from "../src/index";

// Simple test affix file
const testAff = `
SET UTF-8
TRY esianrtolcdugmphbyfvkwzESIANRTOLCDUGMPHBYFVKWZ

REP 2
REP ie ei
REP ei ie

PFX A Y 1
PFX A 0 un .

SFX B Y 2
SFX B 0 s [^sxz]
SFX B 0 es [sxz]

SFX C Y 1
SFX C e ing e

SFX D Y 1
SFX D 0 ed [^e]
`.trim();

// Simple test dictionary
const testDic = `
10
hello/B
world/B
test/ABD
happy/B
color/B
spell/BC
work/BD
like/CD
run/BD
jump/BD
`.trim();

describe("NSpell", () => {
  let spell: NSpell;

  beforeEach(() => {
    spell = new NSpell({ aff: testAff, dic: testDic });
  });

  describe("constructor", () => {
    it("should accept aff and dic as separate arguments", () => {
      const s = new NSpell(testAff, testDic);
      expect(s).toBeInstanceOf(NSpell);
      expect(s.correct("hello")).toBe(true);
    });

    it("should accept aff and dic as object", () => {
      const s = new NSpell({ aff: testAff, dic: testDic });
      expect(s).toBeInstanceOf(NSpell);
    });

    it("should accept array of dictionaries", () => {
      const s = new NSpell([{ aff: testAff, dic: testDic }]);
      expect(s).toBeInstanceOf(NSpell);
    });

    it("should accept Uint8Array input", () => {
      const encoder = new TextEncoder();
      const s = new NSpell({
        aff: encoder.encode(testAff),
        dic: encoder.encode(testDic),
      });
      expect(s).toBeInstanceOf(NSpell);
      expect(s.correct("hello")).toBe(true);
    });

    it("should throw if aff is missing", () => {
      expect(() => new NSpell({} as any)).toThrow("Missing `aff`");
    });

    it("should work with aff only (no dic)", () => {
      const s = new NSpell({ aff: testAff });
      expect(s).toBeInstanceOf(NSpell);
      expect(s.correct("hello")).toBe(false); // No words loaded
    });
  });

  describe("correct()", () => {
    it("should return true for words in dictionary", () => {
      expect(spell.correct("hello")).toBe(true);
      expect(spell.correct("world")).toBe(true);
      expect(spell.correct("test")).toBe(true);
    });

    it("should return false for unknown words", () => {
      expect(spell.correct("xyz")).toBe(false);
      expect(spell.correct("asdf")).toBe(false);
    });

    it("should handle suffixes", () => {
      // B suffix adds 's'
      expect(spell.correct("hellos")).toBe(true);
      expect(spell.correct("worlds")).toBe(true);
      expect(spell.correct("tests")).toBe(true);

      // D suffix adds 'ed'
      expect(spell.correct("tested")).toBe(true);
      expect(spell.correct("worked")).toBe(true);
    });

    it("should handle prefixes", () => {
      // A prefix adds 'un'
      expect(spell.correct("untest")).toBe(true);
      // 'hello' doesn't have A flag
      expect(spell.correct("unhello")).toBe(false);
    });

    it("should be case-insensitive by default", () => {
      expect(spell.correct("Hello")).toBe(true);
      expect(spell.correct("HELLO")).toBe(true);
      expect(spell.correct("hElLo")).toBe(true);
    });

    it("should handle empty string", () => {
      expect(spell.correct("")).toBe(false);
    });

    it("should handle whitespace", () => {
      expect(spell.correct("  hello  ")).toBe(true);
    });
  });

  describe("spell()", () => {
    it("should return correct: true for known words", () => {
      const result = spell.spell("hello");
      expect(result.correct).toBe(true);
      expect(result.forbidden).toBe(false);
      expect(result.warn).toBe(false);
    });

    it("should return correct: false for unknown words", () => {
      const result = spell.spell("xyz");
      expect(result.correct).toBe(false);
      expect(result.forbidden).toBe(false);
    });
  });

  describe("suggest()", () => {
    it("should return empty array for correct words", () => {
      expect(spell.suggest("hello")).toEqual([]);
    });

    it("should suggest corrections for misspelled words", () => {
      // 'helo' is missing an 'l'
      const suggestions = spell.suggest("helo");
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain("hello");
    });

    it("should suggest based on replacements", () => {
      // REP table has ie <-> ei
      // Create a spell checker with word 'receive'
      const s = new NSpell({
        aff: `
SET UTF-8
TRY esianrtolcdugmphbyfvkwz
REP 2
REP ie ei
REP ei ie
`.trim(),
        dic: `1\nreceive`.trim(),
      });

      const suggestions = s.suggest("recieve");
      expect(suggestions).toContain("receive");
    });

    it("should return limited number of suggestions", () => {
      const suggestions = spell.suggest("xyz");
      expect(suggestions.length).toBeLessThanOrEqual(10);
    });
  });

  describe("add()", () => {
    it("should add words to dictionary", () => {
      expect(spell.correct("npm")).toBe(false);
      spell.add("npm");
      expect(spell.correct("npm")).toBe(true);
    });

    it("should add word with model", () => {
      // Add 'code' modeled after 'hello' (which has B flag for plurals)
      spell.add("code", "hello");
      expect(spell.correct("code")).toBe(true);
      expect(spell.correct("codes")).toBe(true); // Should inherit suffix rules
    });

    it("should return this for chaining", () => {
      const result = spell.add("word1").add("word2");
      expect(result).toBe(spell);
      expect(spell.correct("word1")).toBe(true);
      expect(spell.correct("word2")).toBe(true);
    });
  });

  describe("remove()", () => {
    it("should remove words from dictionary", () => {
      expect(spell.correct("hello")).toBe(true);
      spell.remove("hello");
      expect(spell.correct("hello")).toBe(false);
    });

    it("should return this for chaining", () => {
      const result = spell.remove("hello");
      expect(result).toBe(spell);
    });

    it("should not affect other words", () => {
      spell.remove("hello");
      expect(spell.correct("world")).toBe(true);
    });
  });

  describe("dictionary()", () => {
    it("should add additional dictionary words", () => {
      expect(spell.correct("extra")).toBe(false);
      spell.dictionary("extra");
      expect(spell.correct("extra")).toBe(true);
    });

    it("should accept Uint8Array", () => {
      const encoder = new TextEncoder();
      spell.dictionary(encoder.encode("newword"));
      expect(spell.correct("newword")).toBe(true);
    });
  });

  describe("personal()", () => {
    it("should add personal dictionary words", () => {
      spell.personal("customword");
      expect(spell.correct("customword")).toBe(true);
    });

    it("should handle forbidden words with *", () => {
      expect(spell.correct("hello")).toBe(true);
      spell.personal("*hello");
      // After marking as forbidden, it should not be "correct"
      const result = spell.spell("hello");
      expect(result.forbidden).toBe(true);
    });

    it("should handle word/model format", () => {
      spell.personal("newword/hello");
      expect(spell.correct("newword")).toBe(true);
    });
  });

  describe("wordCharacters()", () => {
    it("should return undefined when not set", () => {
      expect(spell.wordCharacters()).toBeUndefined();
    });

    it("should return WORDCHARS when set", () => {
      const s = new NSpell({
        aff: `
SET UTF-8
WORDCHARS 0123456789
`.trim(),
        dic: "1\ntest",
      });
      expect(s.wordCharacters()).toBe("0123456789");
    });
  });

  describe("getStats()", () => {
    it("should return dictionary statistics", () => {
      const stats = spell.getStats();
      expect(stats.words).toBeGreaterThan(0);
      expect(stats.nodes).toBeGreaterThan(0);
      expect(stats.avgDepth).toBeGreaterThan(0);
    });
  });
});
