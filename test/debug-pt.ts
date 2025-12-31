/**
 * Test script to verify Portuguese spell checking suggestions
 */

import { NSpell } from '../src/index';
import pt from '@vandrite/dictionaries/pt';

console.log('Loading Portuguese dictionary...');
const spell = new NSpell({
  aff: pt.aff,
  dic: pt.dic,
});

const stats = spell.getStats();
console.log(`Words: ${stats.words}`);

// Test some words
const testWords = [
  ['você', true],
  ['voce', false],
  ['está', true],
  ['esta', true], // Both are valid (esta = this, está = is)
  ['recebi', true],
  ['recebe', true],
  ['recevi', false],
  ['fazendo', true],
  ['fasendo', false],
  ['português', true],
  ['portugues', false],
] as const;

console.log('\nWord checks:');
let allPassed = true;
for (const [word, expected] of testWords) {
  const result = spell.correct(word);
  const pass = result === expected;
  console.log(`  ${word}: ${result} (expected: ${expected}) ${pass ? '✓' : '✗'}`);
  if (!pass) allPassed = false;
}

console.log(allPassed ? '\n✓ All tests passed!' : '\n✗ Some tests failed!');

// Test suggestions
console.log('\nSuggestions for common typos:');
for (const misspelled of ['voce', 'recevi', 'fasendo', 'portugues', 'nao', 'ateh', 'alem']) {
  const suggestions = spell.suggest(misspelled);
  console.log(`  ${misspelled}: ${suggestions.slice(0, 5).join(', ') || '(none)'}`);
}
