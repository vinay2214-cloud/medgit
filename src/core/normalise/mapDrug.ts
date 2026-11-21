/**
 * Map a raw name (and optional form) to a formulary id by exact contiguous token match.
 * No fuzzy matching, edit distance or phonetics.
 * Validates formulary-normaliser 2.2, 2.3, 2.6.
 */

import { tokens } from '../text';
import type { Formulary } from '../types';

export function mapDrug(name: string | undefined, form: string | undefined, formulary: Formulary): string | null {
  const toks = tokens(`${name ?? ''} ${form ?? ''}`);
  for (const alias of formulary.aliases) {
    const n = alias.tokens.length;
    for (let i = 0; i + n <= toks.length; i++) {
      let hit = true;
      for (let j = 0; j < n; j++) {
        if (toks[i + j] !== alias.tokens[j]) {
          hit = false;
          break;
        }
      }
      if (hit) return alias.id;
    }
  }
  return null;
}
