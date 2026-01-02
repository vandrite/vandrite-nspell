# @vandrite/nspell

> A modern TypeScript rewrite of [nspell](https://github.com/wooorm/nspell) with DAWG-based storage for memory efficiency.

[![npm](https://img.shields.io/npm/v/@vandrite/nspell)](https://www.npmjs.com/package/@vandrite/nspell)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/vandrite/vandrite-nspell/actions/workflows/ci.yml/badge.svg)](https://github.com/vandrite/vandrite-nspell/actions/workflows/ci.yml)

## Why This Fork?

This is a complete rewrite of the original [wooorm/nspell](https://github.com/wooorm/nspell) with the following improvements:

| Feature       | Original nspell | @vandrite/nspell              |
| ------------- | --------------- | ----------------------------- |
| Language      | JavaScript      | **TypeScript**                |
| Types         | None            | **Full type definitions**     |
| Storage       | Plain objects   | **DAWG** (50-80% less memory) |
| Async loading | No              | **Yes**                       |
| API           | ✅              | ✅ **100% compatible**        |

## Features

- 🔤 **Hunspell Compatible**: Full support for `.aff` and `.dic` files
- 🌳 **DAWG Storage**: 50-80% memory reduction vs plain objects
- 📦 **Dual Format**: ESM and CommonJS builds included
- 🔧 **TypeScript**: Full type definitions included
- ⚡ **Async Loading**: Non-blocking dictionary loading for browsers
- 💾 **Cache Persistence**: Save/load suggestion cache across sessions

## Installation

```bash
npm install @vandrite/nspell
```

## Usage

### Basic Usage

```typescript
import NSpell from '@vandrite/nspell';

// Load dictionary (aff and dic content as strings or Uint8Array)
const spell = new NSpell({ aff: affContent, dic: dicContent });

// Check spelling
spell.correct('color'); // true
spell.correct('colour'); // depends on dictionary

// Get suggestions
spell.suggest('speling'); // ['spelling', ...]

// Detailed spell check
spell.spell('hello');
// { correct: true, forbidden: false, warn: false }
```

### With @vandrite/dictionaries

```typescript
import NSpell from '@vandrite/nspell';
import en from '@vandrite/dictionaries/en';

const spell = new NSpell({
  aff: en.aff,
  dic: en.dic,
});

spell.correct('hello'); // true
spell.suggest('helo'); // ['hello', 'help', 'helot', ...]
```

### Async Loading (Browser)

```typescript
import { loadAsync, loadFromUrl } from '@vandrite/nspell/async';

// Load with progress
const spell = await loadAsync(
  { aff: affContent, dic: dicContent },
  {
    onProgress: (loaded, total) => {
      console.log(`Loading: ${Math.round((loaded / total) * 100)}%`);
    },
  },
);

// Or load from URLs
const spell2 = await loadFromUrl(
  'https://cdn.example.com/en.aff',
  'https://cdn.example.com/en.dic',
);
```

### Personal Dictionary

```typescript
// Add custom words
spell.add('npm');
spell.add('TypeScript');

// Add word modeled after existing (inherits affixes)
spell.add('api', 'hello'); // 'apis' will also be valid

// Remove words
spell.remove('colour');

// Forbidden words (personal dictionary format)
spell.personal('*badword');
```

### Cache Persistence

```typescript
// Save suggestion cache (e.g., to localStorage)
const cacheData = spell.exportCache();
localStorage.setItem('spellCache', JSON.stringify(cacheData));

// Load cache on next session
const saved = localStorage.getItem('spellCache');
if (saved) {
  spell.importCache(JSON.parse(saved));
}
```

## API

### `new NSpell(aff, dic?)`

Create a new spell checker instance.

**Signatures:**

```typescript
new NSpell(aff: string, dic?: string)
new NSpell({ aff, dic }: DictionaryInput)
new NSpell(dictionaries: DictionaryInput[])
```

### Methods

| Method              | Returns       | Description                        |
| ------------------- | ------------- | ---------------------------------- |
| `correct(word)`     | `boolean`     | Check if word is spelled correctly |
| `spell(word)`       | `SpellResult` | Detailed spell check result        |
| `suggest(word)`     | `string[]`    | Get spelling suggestions (cached)  |
| `add(word, model?)` | `this`        | Add word to dictionary             |
| `remove(word)`      | `this`        | Remove word from dictionary        |
| `dictionary(dic)`   | `this`        | Load additional dictionary         |
| `personal(dic)`     | `this`        | Load personal dictionary           |
| `wordCharacters()`  | `string?`     | Get WORDCHARS from affix           |
| `getStats()`        | `object`      | Get dictionary statistics          |
| `exportCache()`     | `object`      | Export suggestion cache for saving |
| `importCache(data)` | `void`        | Import previously saved cache      |

### Types

```typescript
interface SpellResult {
  correct: boolean;
  forbidden: boolean;
  warn: boolean;
}

interface DictionaryInput {
  aff: string | Uint8Array | ArrayBuffer;
  dic?: string | Uint8Array | ArrayBuffer;
}
```

## Performance

### Benchmark vs Original nspell

| Metric                    | Original nspell | @vandrite/nspell | Improvement         |
| ------------------------- | --------------- | ---------------- | ------------------- |
| Construction              | 67.41 ms        | 81.00 ms         | 1.20x slower        |
| Correct word check        | 0.0017 ms       | 0.0004 ms        | **3.92x faster** ✅ |
| Incorrect word check      | 0.0022 ms       | 0.0007 ms        | **2.97x faster** ✅ |
| Suggestions (cold)        | 11.54 ms        | 7.77 ms          | **1.49x faster** ✅ |
| Suggestions (warm/cached) | 5.97 ms         | 0.001 ms         | **5897x faster** ✅ |
| Add word                  | 0.0007 ms       | 0.0005 ms        | **1.29x faster** ✅ |

_Tested with English dictionary (en), 1000 iterations_

> **Note**: The LRU cache provides massive speedups for repeated suggestion queries. Use `exportCache()` and `importCache()` to persist the cache between sessions.

> **Note**: Construction is volatile in both versions, so it shouldn't be heavily relied upon.

### Memory Efficiency

The DAWG (Directed Acyclic Word Graph) structure provides significant memory savings by sharing common prefixes:

| Dictionary      | Plain Object | DAWG   | Savings |
| --------------- | ------------ | ------ | ------- |
| English (en)    | ~15 MB       | ~5 MB  | 67%     |
| German (de)     | ~40 MB       | ~12 MB | 70%     |
| Portuguese (pt) | ~20 MB       | ~7 MB  | 65%     |

## Credits

This project is a TypeScript rewrite of [nspell](https://github.com/wooorm/nspell) by [Titus Wormer](https://github.com/wooorm).

The original nspell is an excellent Hunspell-compatible spell checker for JavaScript. This fork adds TypeScript support, DAWG-based storage for memory efficiency, and async loading utilities.

## Contributing

Contributions are welcome! Please check out our [contribution guidelines](CONTRIBUTING.md) to get started.

## License

[MIT](LICENSE) © Vandrite
