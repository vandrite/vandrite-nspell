/**
 * Phonetic algorithms (Soundex, Double Metaphone) for spelling suggestions
 */

/** Soundex algorithm - encodes words by their phonetic sound */
export function soundex(word: string): string {
  if (!word || word.length === 0) return '';

  const upper = word.toUpperCase();
  const firstLetter = upper[0];

  // Mapping of letters to Soundex digits
  const codes: Record<string, string> = {
    B: '1',
    F: '1',
    P: '1',
    V: '1',
    C: '2',
    G: '2',
    J: '2',
    K: '2',
    Q: '2',
    S: '2',
    X: '2',
    Z: '2',
    D: '3',
    T: '3',
    L: '4',
    M: '5',
    N: '5',
    R: '6',
  };

  let result = firstLetter;
  let prevCode = codes[firstLetter] || '';

  for (let i = 1; i < upper.length && result.length < 4; i++) {
    const char = upper[i];
    const code = codes[char];

    if (code && code !== prevCode) {
      result += code;
      prevCode = code;
    } else if (!code) {
      // Vowels and H, W reset the previous code
      prevCode = '';
    }
  }

  // Pad with zeros to ensure 4 characters
  return (result + '000').slice(0, 4);
}

/** Double Metaphone - returns primary and alternate phonetic codes */
export function doubleMetaphone(word: string): [string, string] {
  if (!word || word.length === 0) return ['', ''];

  const upper = word.toUpperCase();
  let primary = '';
  let secondary = '';
  let current = 0;
  const length = upper.length;

  // Helper to check character at position
  const charAt = (pos: number): string => (pos >= 0 && pos < length ? upper[pos] : '');

  // Helper to check if character is a vowel
  const isVowel = (char: string): boolean => 'AEIOU'.includes(char);

  // Skip silent letters at start
  if (['GN', 'KN', 'PN', 'WR', 'PS'].some((prefix) => upper.startsWith(prefix))) {
    current = 1;
  }

  // Handle initial X (sounds like Z)
  if (charAt(0) === 'X') {
    primary += 'S';
    secondary += 'S';
    current = 1;
  }

  while (current < length) {
    const char = charAt(current);

    switch (char) {
      case 'A':
      case 'E':
      case 'I':
      case 'O':
      case 'U':
        // Vowels only matter at the beginning
        if (current === 0) {
          primary += 'A';
          secondary += 'A';
        }
        current++;
        break;

      case 'B':
        primary += 'P';
        secondary += 'P';
        current += charAt(current + 1) === 'B' ? 2 : 1;
        break;

      case 'C':
        // Various C sounds
        if (charAt(current + 1) === 'H') {
          primary += 'X';
          secondary += 'X';
          current += 2;
        } else if (charAt(current + 1) === 'I' || charAt(current + 1) === 'E') {
          primary += 'S';
          secondary += 'S';
          current += 1;
        } else if (charAt(current + 1) === 'K') {
          primary += 'K';
          secondary += 'K';
          current += 2;
        } else {
          primary += 'K';
          secondary += 'K';
          current++;
        }
        break;

      case 'D':
        if (charAt(current + 1) === 'G') {
          if ('IEY'.includes(charAt(current + 2))) {
            primary += 'J';
            secondary += 'J';
            current += 3;
          } else {
            primary += 'TK';
            secondary += 'TK';
            current += 2;
          }
        } else {
          primary += 'T';
          secondary += 'T';
          current++;
        }
        break;

      case 'F':
        primary += 'F';
        secondary += 'F';
        current += charAt(current + 1) === 'F' ? 2 : 1;
        break;

      case 'G':
        if (charAt(current + 1) === 'H') {
          if (current > 0 && !isVowel(charAt(current - 1))) {
            primary += 'K';
            secondary += 'K';
          }
          current += 2;
        } else if (charAt(current + 1) === 'N') {
          current += 2;
        } else if ('IEY'.includes(charAt(current + 1))) {
          primary += 'J';
          secondary += 'K';
          current += 2;
        } else {
          primary += 'K';
          secondary += 'K';
          current++;
        }
        break;

      case 'H':
        // H is silent between vowels or at end
        if (current === 0 || isVowel(charAt(current - 1))) {
          if (isVowel(charAt(current + 1))) {
            primary += 'H';
            secondary += 'H';
          }
        }
        current++;
        break;

      case 'J':
        primary += 'J';
        secondary += 'J';
        current++;
        break;

      case 'K':
        primary += 'K';
        secondary += 'K';
        current += charAt(current + 1) === 'K' ? 2 : 1;
        break;

      case 'L':
        primary += 'L';
        secondary += 'L';
        current += charAt(current + 1) === 'L' ? 2 : 1;
        break;

      case 'M':
        primary += 'M';
        secondary += 'M';
        current += charAt(current + 1) === 'M' ? 2 : 1;
        break;

      case 'N':
        primary += 'N';
        secondary += 'N';
        current += charAt(current + 1) === 'N' ? 2 : 1;
        break;

      case 'Ñ':
        primary += 'N';
        secondary += 'N';
        current++;
        break;

      case 'P':
        if (charAt(current + 1) === 'H') {
          primary += 'F';
          secondary += 'F';
          current += 2;
        } else {
          primary += 'P';
          secondary += 'P';
          current += charAt(current + 1) === 'P' ? 2 : 1;
        }
        break;

      case 'Q':
        primary += 'K';
        secondary += 'K';
        current += charAt(current + 1) === 'U' ? 2 : 1;
        break;

      case 'R':
        primary += 'R';
        secondary += 'R';
        current += charAt(current + 1) === 'R' ? 2 : 1;
        break;

      case 'S':
        if (charAt(current + 1) === 'H') {
          primary += 'X';
          secondary += 'X';
          current += 2;
        } else if (charAt(current + 1) === 'I' && 'OA'.includes(charAt(current + 2))) {
          primary += 'S';
          secondary += 'X';
          current += 3;
        } else {
          primary += 'S';
          secondary += 'S';
          current += charAt(current + 1) === 'S' ? 2 : 1;
        }
        break;

      case 'T':
        if (charAt(current + 1) === 'H') {
          primary += '0'; // Using 0 for TH sound
          secondary += 'T';
          current += 2;
        } else if (charAt(current + 1) === 'I' && 'OA'.includes(charAt(current + 2))) {
          primary += 'X';
          secondary += 'X';
          current += 3;
        } else {
          primary += 'T';
          secondary += 'T';
          current += charAt(current + 1) === 'T' ? 2 : 1;
        }
        break;

      case 'V':
        primary += 'F';
        secondary += 'F';
        current++;
        break;

      case 'W':
        if (isVowel(charAt(current + 1))) {
          primary += 'A';
          secondary += 'F';
        }
        current++;
        break;

      case 'X':
        primary += 'KS';
        secondary += 'KS';
        current++;
        break;

      case 'Y':
        if (isVowel(charAt(current + 1))) {
          primary += 'A';
          secondary += 'A';
        }
        current++;
        break;

      case 'Z':
        primary += 'S';
        secondary += 'S';
        current += charAt(current + 1) === 'Z' ? 2 : 1;
        break;

      default:
        current++;
    }
  }

  return [primary, secondary];
}

/** Calculate phonetic similarity score (0-1) */
export function phoneticSimilarity(word1: string, word2: string): number {
  // Try Double Metaphone first (more accurate)
  const [primary1, secondary1] = doubleMetaphone(word1);
  const [primary2, secondary2] = doubleMetaphone(word2);

  // Check for exact matches
  if (primary1 === primary2) return 1.0;
  if (primary1 === secondary2 || secondary1 === primary2) return 0.9;
  if (secondary1 === secondary2 && secondary1 !== '') return 0.8;

  // Fall back to Soundex for partial matching
  const soundex1 = soundex(word1);
  const soundex2 = soundex(word2);

  if (soundex1 === soundex2) return 0.7;

  // Calculate character overlap in Soundex codes
  let matches = 0;
  for (let i = 0; i < 4; i++) {
    if (soundex1[i] === soundex2[i]) matches++;
  }

  return (matches / 4) * 0.5; // Scale to 0-0.5 range for partial matches
}
