import { describe, expect, it } from 'vitest';
import vectors from '../../data/vectors/canonical.json';
import { canonicalise, sha256Hex } from '@core';

describe('golden: canonical JSON and SHA-256 vectors', () => {
  for (const v of vectors.canonical) {
    // Validates: history-audit 2.1, 2.2, 2.4, 2.5
    it(v.name, () => {
      const c = canonicalise(v.value);
      expect(c).toEqual({ ok: true, value: v.canonical });
      expect(sha256Hex(v.canonical)).toBe(v.sha256);
    });
  }
  for (const v of vectors.sha256) {
    // Validates: history-audit 2.5
    it(v.name, () => expect(sha256Hex(v.input)).toBe(v.sha256));
  }

  // Validates: history-audit 2.3
  it.each([
    ['NaN', { n: NaN }, 'n'],
    ['Infinity', { a: [1, Infinity] }, 'a[1]'],
    ['undefined in an array', { a: [1, undefined] }, 'a[1]'],
    ['a function', { f: () => 1 }, 'f'],
    ['a bigint', { b: BigInt(1) }, 'b'],
    ['a Date', { d: new Date(0) }, 'd'],
    ['a symbol', { s: Symbol('x') }, 's'],
  ])('rejects %s', (_name, value, path) => {
    expect(canonicalise(value)).toEqual({ ok: false, error: { code: 'CANONICAL_INVALID', path } });
  });

  // Validates: history-audit 2.1
  it('omits undefined object properties and keeps null', () => {
    expect(canonicalise({ b: undefined, a: null })).toEqual({ ok: true, value: '{"a":null}' });
  });
});
