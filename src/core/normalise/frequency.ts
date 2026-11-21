/**
 * Frequency parsing and formatting.
 * Validates formulary-normaliser 4.1 to 4.7.
 */

import { norm } from '../text';
import type { Frequency } from '../types';

/** Synonym classes, exported so tests can iterate them. Keys are normalised phrases. */
export const FREQUENCY_SYNONYMS = {
  1: ['od', 'qd', 'once daily', 'once a day', 'once', 'daily', 'hs', 'at night', 'nocte', 'night', 'mane', 'morning', 'every morning', 'in the morning', 'at bedtime', 'bedtime', '1 day'],
  2: ['bd', 'bid', 'bds', 'twice daily', 'twice a day', '2 times a day', 'two times daily'],
  3: ['tds', 'tid', 'three times daily', 'three times a day', '3 times a day'],
  4: ['qid', 'qds', 'four times daily', '4 times a day'],
  prn: ['prn', 'sos', 'as needed', 'when required', 'if needed', 'as required'],
} as const;

const LOOKUP = new Map<string, Frequency>();
for (const n of [1, 2, 3, 4] as const) {
  for (const phrase of FREQUENCY_SYNONYMS[n]) LOOKUP.set(phrase, { kind: 'scheduled', perDay: n });
}
for (const phrase of FREQUENCY_SYNONYMS.prn) LOOKUP.set(phrase, { kind: 'prn' });

function scheduled(n: number): Frequency | null {
  return n === 1 || n === 2 || n === 3 || n === 4 ? { kind: 'scheduled', perDay: n } : null;
}

export function parseFrequency(text: string | undefined): Frequency | null {
  if (!text) return null;
  const t = text.trim().toLowerCase();
  const pattern = /^([01])-([01])-([01])(?:-([01]))?$/.exec(t);
  if (pattern) {
    const sum = pattern.slice(1).reduce((acc, g) => acc + (g === undefined ? 0 : Number(g)), 0);
    return scheduled(sum);
  }
  const perDay = /^([1-4])\s*\/\s*day$/.exec(t);
  if (perDay && perDay[1] !== undefined) return scheduled(Number(perDay[1]));
  const found = LOOKUP.get(norm(t.replace(/\./g, '')));
  return found ? { ...found } : null;
}

/** "2/day", "prn", or "null". */
export function formatFrequency(f: Frequency | null): string {
  if (f === null) return 'null';
  return f.kind === 'prn' ? 'prn' : `${f.perDay}/day`;
}
