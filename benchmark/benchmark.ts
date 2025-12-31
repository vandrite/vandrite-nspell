/**
 * Benchmark: @vandrite/nspell vs nspell (original)
 *
 * Compares performance and memory usage between the two implementations.
 *
 * Run with: npm run benchmark
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// @ts-expect-error - original nspell doesn't have types
import originalNSpell from 'nspell';
import VandriteNSpell from '../src/index';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Log output collector
const logLines: string[] = [];

function log(message: string = ''): void {
  console.log(message);
  logLines.push(message);
}

// Try to use @vandrite/dictionaries if available, otherwise use test fixtures
let affContent: string;
let dicContent: string;
let dictionarySize = 'minimal';

try {
  // Try to load from @vandrite/dictionaries - check the correct path
  const dictBasePath = join(__dirname, '../node_modules/@vandrite/dictionaries/dictionaries/en');
  affContent = readFileSync(join(dictBasePath, 'index.aff'), 'utf8');
  dicContent = readFileSync(join(dictBasePath, 'index.dic'), 'utf8');
  dictionarySize = 'full (en)';
  log('📚 Using @vandrite/dictionaries/en');
} catch {
  // Fallback to basic test fixture
  log('⚠️ @vandrite/dictionaries not found, using minimal test dictionary');
  affContent = `SET UTF-8
TRY esianrtolcdugmphbyfvkwzESIANRTOLCDUGMPHBYFVKWZ
SFX S Y 1
SFX S 0 s .
SFX D Y 2
SFX D 0 ed [^ey]
SFX D y ied [^aeiou]y
PFX U Y 1
PFX U 0 un .
`;
  dicContent = `5
hello/S
world/S
test/SD
happy/U
good/S
`;
}

// Test words - use different words based on dictionary
const correctWords =
  dictionarySize === 'full (en)'
    ? ['hello', 'world', 'test', 'computer', 'programming', 'development']
    : ['hello', 'world', 'test', 'tests', 'tested', 'unhappy'];

const incorrectWords = ['helo', 'wrold', 'testt', 'hapyy', 'helllo', 'wordl'];

// Number of iterations for each test
const ITERATIONS = 1000;
const WARM_UP = 100;

interface BenchmarkResult {
  name: string;
  operation: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  opsPerSec: number;
}

function benchmark<T>(
  name: string,
  operation: string,
  fn: () => T,
  iterations: number = ITERATIONS,
): BenchmarkResult {
  // Warm up
  for (let i = 0; i < WARM_UP; i++) {
    fn();
  }

  // Force GC if available
  if (global.gc) {
    global.gc();
  }

  // Benchmark
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();

  const totalMs = end - start;
  const avgMs = totalMs / iterations;
  const opsPerSec = 1000 / avgMs;

  return {
    name,
    operation,
    iterations,
    totalMs,
    avgMs,
    opsPerSec,
  };
}

function printResult(result: BenchmarkResult): void {
  log(
    `  ${result.name.padEnd(12)} | ${result.avgMs
      .toFixed(4)
      .padStart(12)} ms | ${result.opsPerSec.toFixed(0).padStart(12)} ops/s`,
  );
}

function printComparison(
  label: string,
  original: BenchmarkResult,
  vandrite: BenchmarkResult,
): void {
  const speedup = original.avgMs / vandrite.avgMs;
  const faster = speedup > 1 ? 'vandrite' : 'original';
  const factor = speedup > 1 ? speedup : 1 / speedup;
  const icon = faster === 'vandrite' ? '✅' : '❌';

  log(
    `  ${label.padEnd(20)} | ${factor.toFixed(2)}x ${
      faster === 'vandrite' ? 'faster' : 'slower'
    } ${icon}`,
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function runBenchmarks(): Promise<void> {
  const startTime = new Date();

  log();
  log('🔬 Benchmark: @vandrite/nspell vs nspell (original)');
  log('='.repeat(60));
  log(`📅 Date: ${startTime.toISOString()}`);
  log(`📖 Dictionary: ${dictionarySize}`);
  log(`🔄 Iterations: ${ITERATIONS} (warm-up: ${WARM_UP})`);
  log();

  // Memory before loading
  const memBefore = process.memoryUsage();
  log(`📊 Memory before: ${formatBytes(memBefore.heapUsed)}`);
  log();

  // ===========================================================================
  // Construction Benchmark
  // ===========================================================================
  log('📦 CONSTRUCTION (loading dictionary)');
  log('-'.repeat(60));

  const constructOriginal = benchmark(
    'original',
    'new NSpell()',
    () => originalNSpell({ aff: affContent, dic: dicContent }),
    50, // Fewer iterations as construction is slow
  );
  printResult(constructOriginal);

  const constructVandrite = benchmark(
    '@vandrite',
    'new NSpell()',
    () => new VandriteNSpell({ aff: affContent, dic: dicContent }),
    50,
  );
  printResult(constructVandrite);
  log();

  // Create instances for further tests
  const original = originalNSpell({ aff: affContent, dic: dicContent });
  const vandrite = new VandriteNSpell({ aff: affContent, dic: dicContent });

  // Memory after loading
  if (global.gc) global.gc();
  const memAfter = process.memoryUsage();
  log(
    `📊 Memory after loading: ${formatBytes(memAfter.heapUsed)} (+${formatBytes(
      memAfter.heapUsed - memBefore.heapUsed,
    )})`,
  );
  log();

  // ===========================================================================
  // Correct Word Check Benchmark
  // ===========================================================================
  log('✅ CORRECT WORD CHECK');
  log('-'.repeat(60));

  const correctOriginal = benchmark('original', 'correct()', () => {
    for (const word of correctWords) {
      original.correct(word);
    }
  });
  printResult(correctOriginal);

  const correctVandrite = benchmark('@vandrite', 'correct()', () => {
    for (const word of correctWords) {
      vandrite.correct(word);
    }
  });
  printResult(correctVandrite);
  log();

  // ===========================================================================
  // Incorrect Word Check Benchmark
  // ===========================================================================
  log('❌ INCORRECT WORD CHECK');
  log('-'.repeat(60));

  const incorrectOriginal = benchmark('original', 'correct()', () => {
    for (const word of incorrectWords) {
      original.correct(word);
    }
  });
  printResult(incorrectOriginal);

  const incorrectVandrite = benchmark('@vandrite', 'correct()', () => {
    for (const word of incorrectWords) {
      vandrite.correct(word);
    }
  });
  printResult(incorrectVandrite);
  log();

  // ===========================================================================
  // Suggestion Benchmark
  // ===========================================================================
  log('💡 SUGGESTIONS');
  log('-'.repeat(60));

  const suggestOriginal = benchmark(
    'original',
    'suggest()',
    () => {
      for (const word of incorrectWords) {
        original.suggest(word);
      }
    },
    50, // Fewer iterations as suggestions are slower
  );
  printResult(suggestOriginal);

  const suggestVandrite = benchmark(
    '@vandrite',
    'suggest()',
    () => {
      for (const word of incorrectWords) {
        vandrite.suggest(word);
      }
    },
    50,
  );
  printResult(suggestVandrite);
  log();

  // ===========================================================================
  // Add Word Benchmark
  // ===========================================================================
  log('➕ ADD WORD');
  log('-'.repeat(60));

  let counter = 0;
  const addOriginal = benchmark('original', 'add()', () => {
    original.add(`customword${counter++}`);
  });
  printResult(addOriginal);

  counter = 0;
  const addVandrite = benchmark('@vandrite', 'add()', () => {
    vandrite.add(`customword${counter++}`);
  });
  printResult(addVandrite);
  log();

  // ===========================================================================
  // Summary
  // ===========================================================================
  log('='.repeat(60));
  log('📊 SUMMARY');
  log('='.repeat(60));

  const results = [
    { label: 'Construction', o: constructOriginal, v: constructVandrite },
    { label: 'Correct check', o: correctOriginal, v: correctVandrite },
    { label: 'Incorrect check', o: incorrectOriginal, v: incorrectVandrite },
    { label: 'Suggestions', o: suggestOriginal, v: suggestVandrite },
    { label: 'Add word', o: addOriginal, v: addVandrite },
  ];

  for (const { label, o, v } of results) {
    printComparison(label, o, v);
  }

  // Calculate overall
  const totalOriginal = results.reduce((sum, r) => sum + r.o.avgMs, 0);
  const totalVandrite = results.reduce((sum, r) => sum + r.v.avgMs, 0);
  const overallSpeedup = totalOriginal / totalVandrite;
  const overallFaster = overallSpeedup > 1 ? 'vandrite' : 'original';
  const overallFactor = overallSpeedup > 1 ? overallSpeedup : 1 / overallSpeedup;

  log('-'.repeat(60));
  log(
    `  ${'OVERALL'.padEnd(20)} | ${overallFactor.toFixed(2)}x ${
      overallFaster === 'vandrite' ? 'faster ✅' : 'slower ❌'
    }`,
  );

  const endTime = new Date();
  const duration = (endTime.getTime() - startTime.getTime()) / 1000;

  log();
  log(`⏱️ Total benchmark time: ${duration.toFixed(2)}s`);
  log('✨ Benchmark complete!');

  // Write log to file
  const logFilePath = join(__dirname, 'benchmark-results.txt');
  writeFileSync(logFilePath, logLines.join('\n'), 'utf8');
  console.log();
  console.log(`📄 Results saved to: ${logFilePath}`);
}

// Run
runBenchmarks().catch(console.error);
