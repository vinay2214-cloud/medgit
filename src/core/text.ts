/**
 * String normalisation shared by the formulary index and the parsers.
 * Validates formulary-normaliser 2.1.
 */

/** Lower-case, replace every run of characters other than a-z and 0-9 with one space, trim. */
export function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Tokens of the normalised text; never contains empty strings. */
export function tokens(s: string): string[] {
  const n = norm(s);
  return n === '' ? [] : n.split(' ');
}

/** Plain UTF-16 code unit comparison. Never localeCompare, so results are identical everywhere. */
export function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
