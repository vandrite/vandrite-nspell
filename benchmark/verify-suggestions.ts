import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import VandriteNSpell from '../src/index';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function verify() {
  console.log('🧪 Verifying Suggestions Caching');

  // Load full dictionary
  const dictBasePath = join(__dirname, '../node_modules/@vandrite/dictionaries/dictionaries/en');
  const aff = readFileSync(join(dictBasePath, 'index.aff'), 'utf8');
  const dic = readFileSync(join(dictBasePath, 'index.dic'), 'utf8');

  const nspell = new VandriteNSpell({ aff, dic });

  const word = 'helo'; // incorrect word

  // First run (uncached)
  const start1 = performance.now();
  const res1 = nspell.suggest(word);
  const end1 = performance.now();
  console.log(`Run 1 (Uncached): ${(end1 - start1).toFixed(4)}ms`);
  console.log(`Results: ${res1.join(', ')}`);

  // Second run (cached)
  const start2 = performance.now();
  const res2 = nspell.suggest(word);
  const end2 = performance.now();
  console.log(`Run 2 (Cached):   ${(end2 - start2).toFixed(4)}ms`);

  // Different word (uncached)
  const start3 = performance.now();
  const res3 = nspell.suggest('wrold');
  const end3 = performance.now();
  console.log(`Run 3 (Uncached): ${(end3 - start3).toFixed(4)}ms`);

  // Run with unique words loop to estimate real OPS
  console.log('\nBenchmarking 100 unique words...');
  const startLoop = performance.now();
  for (let i = 0; i < 100; i++) {
    nspell.suggest(`test${i}`); // likely not in cache
  }
  const endLoop = performance.now();
  const avg = (endLoop - startLoop) / 100;
  console.log(`Avg time per unique word: ${avg.toFixed(4)}ms (~${(1000 / avg).toFixed(0)} ops/s)`);
}

verify().catch(console.error);
