/**
 * Test script to verify spell checking works correctly
 */

import { NSpell } from "../src/index";
import en from "@vandrite/dictionaries/en";

console.log("Loading English dictionary...");
const spell = new NSpell({
  aff: en.aff,
  dic: en.dic,
});

const stats = spell.getStats();
console.log(`Words: ${stats.words}`);

// Test some words
const testWords = [
  ["hello", true],
  ["helo", false],
  ["world", true],
  ["wrold", false],
  ["computer", true],
  ["computr", false],
  ["the", true],
  ["teh", false],
  ["spelling", true],
  ["speling", false],
] as const;

console.log("\nWord checks:");
let allPassed = true;
for (const [word, expected] of testWords) {
  const result = spell.correct(word);
  const pass = result === expected;
  console.log(
    `  ${word}: ${result} (expected: ${expected}) ${pass ? "✓" : "✗"}`
  );
  if (!pass) allPassed = false;
}

console.log(allPassed ? "\n✓ All tests passed!" : "\n✗ Some tests failed!");

// Test suggestions
console.log("\nSuggestions:");
for (const misspelled of ["helo", "wrold", "teh", "speling"]) {
  const suggestions = spell.suggest(misspelled);
  console.log(
    `  ${misspelled}: ${suggestions.slice(0, 5).join(", ") || "(none)"}`
  );
}
