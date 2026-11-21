/**
 * Strength parsing and formatting.
 * Validates formulary-normaliser 3.1 to 3.4, 3.6, 3.8.
 */

import type { Strength, Unit } from '../types';

const STRENGTH_RE = /(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?\s*(mg|mcg|µg|ug|g|ml|iu)\b/i;

/** Factor to milligrams for each accepted mass spelling. */
const MASS_TO_MG: Readonly<Record<string, number>> = { g: 1000, mg: 1, mcg: 0.001, ug: 0.001, 'µg': 0.001 };

export function round6(x: number): number {
  const r = Math.round(x * 1e6) / 1e6;
  return r === 0 ? 0 : r; // never -0
}

/**
 * Read the first strength in the text and express it in the canonical unit.
 * `canonicalUnit` is null for unmapped drugs. Returns null if nothing can be read or converted.
 */
export function parseStrength(text: string | undefined, canonicalUnit: Unit | null): Strength | null {
  if (!text) return null;
  const m = STRENGTH_RE.exec(text);
  if (!m || m[1] === undefined || m[3] === undefined) return null;
  const raw = [Number(m[1]), ...(m[2] !== undefined ? [Number(m[2])] : [])];
  const unit = m[3].toLowerCase();

  const inFactor = MASS_TO_MG[unit];
  if (inFactor !== undefined) {
    const target: Unit = canonicalUnit ?? (unit === 'mcg' || unit === 'ug' || unit === 'µg' ? 'mcg' : 'mg');
    const outFactor = MASS_TO_MG[target];
    if (outFactor === undefined) return null; // canonical unit is ml or iu
    return { values: raw.map((v) => round6((v * inFactor) / outFactor)), unit: target };
  }
  // ml or iu: valid only when the drug is unmapped or the canonical unit matches
  const u = unit as Unit;
  if (canonicalUnit === null || canonicalUnit === u) return { values: raw.map(round6), unit: u };
  return null;
}

/** "500 mg", "800/160 mg", "0.4 mg", or "null". */
export function formatStrength(s: Strength | null): string {
  if (s === null) return 'null';
  return `${s.values.map((v) => String(v)).join('/')} ${s.unit}`;
}
