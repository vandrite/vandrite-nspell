import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import VandriteNSpell from '../src/index';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function verify() {
  console.log('START_VERIFY');

  const dictBasePath = join(__dirname, '../node_modules/@vandrite/dictionaries/dictionaries/en');
  const aff = readFileSync(join(dictBasePath, 'index.aff'), 'utf8');
  const dic = readFileSync(join(dictBasePath, 'index.dic'), 'utf8');

  const nspell = new VandriteNSpell({ aff, dic });

  // Trigger lazy build
  nspell.suggest('init');

  // Measure new words
  const words = ['wrold', 'helo', 'tset', 'cmputer', 'prgogramming'];

  let total = 0;
  for (const w of words) {
    const start = performance.now();
    nspell.suggest(w);
    const end = performance.now();
    total += end - start;
  }

  console.log(`Avg time for new words: ${(total / words.length).toFixed(4)}ms`);
  console.log('END_VERIFY');
}

verify().catch(console.error);
