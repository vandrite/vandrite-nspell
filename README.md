# @vandrite/nspell

> A modern TypeScript rewrite of [nspell](https://github.com/wooorm/nspell) with DAWG-based storage for memory efficiency.

[![npm](https://img.shields.io/npm/v/@vandrite/nspell)](https://www.npmjs.com/package/@vandrite/nspell)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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

## Installation

```bash
npm install @vandrite/nspell
```

## Usage

### Basic Usage

```typescript
import NSpell from "@vandrite/nspell";

// Load dictionary (aff and dic content as strings or Uint8Array)
const spell = new NSpell({ aff: affContent, dic: dicContent });

// Check spelling
spell.correct("color"); // true
spell.correct("colour"); // depends on dictionary

// Get suggestions
spell.suggest("speling"); // ['spelling', ...]

// Detailed spell check
spell.spell("hello");
// { correct: true, forbidden: false, warn: false }
```

### With @vandrite/dictionaries

```typescript
import NSpell from "@vandrite/nspell";
import en from "@vandrite/dictionaries/en";

const spell = new NSpell({
  aff: en.aff,
  dic: en.dic,
});

spell.correct("hello"); // true
spell.suggest("helo"); // ['hello', 'help', 'helot', ...]
```

### Async Loading (Browser)

```typescript
import { loadAsync, loadFromUrl } from "@vandrite/nspell/async";

// Load with progress
const spell = await loadAsync(
  { aff: affContent, dic: dicContent },
  {
    onProgress: (loaded, total) => {
      console.log(`Loading: ${Math.round((loaded / total) * 100)}%`);
    },
  }
);

// Or load from URLs
const spell2 = await loadFromUrl(
  "https://cdn.example.com/en.aff",
  "https://cdn.example.com/en.dic"
);
```

### Personal Dictionary

```typescript
// Add custom words
spell.add("npm");
spell.add("TypeScript");

// Add word modeled after existing (inherits affixes)
spell.add("api", "hello"); // 'apis' will also be valid

// Remove words
spell.remove("colour");

// Forbidden words (personal dictionary format)
spell.personal("*badword");
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
| `suggest(word)`     | `string[]`    | Get spelling suggestions           |
| `add(word, model?)` | `this`        | Add word to dictionary             |
| `remove(word)`      | `this`        | Remove word from dictionary        |
| `dictionary(dic)`   | `this`        | Load additional dictionary         |
| `personal(dic)`     | `this`        | Load personal dictionary           |
| `wordCharacters()`  | `string?`     | Get WORDCHARS from affix           |
| `getStats()`        | `object`      | Get dictionary statistics          |

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

The DAWG (Directed Acyclic Word Graph) structure provides significant memory savings by sharing common prefixes:

| Dictionary      | Plain Object | DAWG   | Savings |
| --------------- | ------------ | ------ | ------- |
| English (en)    | ~15 MB       | ~5 MB  | 67%     |
| German (de)     | ~40 MB       | ~12 MB | 70%     |
| Portuguese (pt) | ~20 MB       | ~7 MB  | 65%     |

## Credits

This project is a TypeScript rewrite of [nspell](https://github.com/wooorm/nspell) by [Titus Wormer](https://github.com/wooorm).

The original nspell is an excellent Hunspell-compatible spell checker for JavaScript. This fork adds TypeScript support, DAWG-based storage for memory efficiency, and async loading utilities.

## License

[MIT](LICENSE) © Vandrite
