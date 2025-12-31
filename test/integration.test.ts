/**
 * Integration tests with real vandrite-dictionaries
 *
 * These tests verify that @vandrite/nspell works correctly with
 * the actual dictionary files from @vandrite/dictionaries.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { NSpell } from "../src/index";

// Import only English dictionary to save memory
import en from "@vandrite/dictionaries/en";

describe("Integration: English Dictionary", () => {
  let spell: NSpell;

  beforeAll(() => {
    spell = new NSpell({
      aff: en.aff,
      dic: en.dic,
    });
  });

  describe("correct()", () => {
    it("should recognize common English words", () => {
      expect(spell.correct("hello")).toBe(true);
      expect(spell.correct("world")).toBe(true);
      expect(spell.correct("the")).toBe(true);
      expect(spell.correct("and")).toBe(true);
      expect(spell.correct("computer")).toBe(true);
    });

    it("should reject misspelled words", () => {
      expect(spell.correct("helo")).toBe(false);
      expect(spell.correct("wrold")).toBe(false);
      expect(spell.correct("computr")).toBe(false);
    });

    it("should handle casing", () => {
      expect(spell.correct("Hello")).toBe(true);
      expect(spell.correct("HELLO")).toBe(true);
      expect(spell.correct("The")).toBe(true);
    });
  });

  describe("suggest()", () => {
    it("should suggest corrections for misspelled words", () => {
      const suggestions = spell.suggest("helo");
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe("dictionary stats", () => {
    it("should have loaded words", () => {
      const stats = spell.getStats();
      expect(stats.words).toBeGreaterThan(1000);
      console.log(
        `English dictionary: ${stats.words} words, ${stats.nodes} nodes`
      );
    });
  });
});

describe("Performance", () => {
  it("should check spelling quickly", () => {
    const spell = new NSpell({
      aff: en.aff,
      dic: en.dic,
    });

    const words = ["hello", "world", "computer", "testing", "spelling"];
    const start = performance.now();

    for (let i = 0; i < 100; i++) {
      for (const word of words) {
        spell.correct(word);
      }
    }

    const checkTime = performance.now() - start;
    const checksPerSecond = 500 / (checkTime / 1000);

    console.log(`Spelling checks: ${checksPerSecond.toFixed(0)}/second`);
    expect(checksPerSecond).toBeGreaterThan(100); // At least 100 checks/sec
  });
});
