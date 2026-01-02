import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import VandriteNSpell from '../src/index';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function bench() {
  const dictBasePath = join(__dirname, '../node_modules/@vandrite/dictionaries/dictionaries/en');
  const aff = readFileSync(join(dictBasePath, 'index.aff'), 'utf8');
  const dic = readFileSync(join(dictBasePath, 'index.dic'), 'utf8');

  const ITER = 20;
  const start = performance.now();
  for (let i = 0; i < ITER; i++) {
    new VandriteNSpell({ aff, dic });
  }
  const end = performance.now();

  console.log(`Construction Avg: ${((end - start) / ITER).toFixed(2)}ms`);
}

bench().catch(console.error);
