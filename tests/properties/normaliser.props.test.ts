import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ISSUE_CODES, FREQUENCY_SYNONYMS, formatFrequency, mapDrug, norm, normaliseItem, parseFrequency, parseStrength, renderRaw } from '@core';
import { runs } from '../helpers/fc';
import { formulary } from '../helpers/data';
import { genFormularyItem, genFreqCanonical, genMessyAlias, genStatus } from '../helpers/gen';

const opts = () => ({ numRuns: runs(), verbose: 1 as const });
const allAliases = new Set(formulary.aliases.map((a) => a.tokens.join(' ')));

describe('formulary-normaliser properties', () => {
  // Validates: formulary-normaliser 7.3
  it('P-N1 round trip', () => {
    fc.assert(
      fc.property(genFormularyItem.chain((item) => fc.tuple(fc.constant(item), fc.constantFrom(...item.strengths), genFreqCanonical, genStatus)), ([item, values, frequency, status]) => {
        const entry = { drugKey: item.id, displayName: item.display, strength: { values, unit: item.canonicalUnit }, frequency, status, flags: [] };
        const { entry: back, issues } = normaliseItem(renderRaw(entry), formulary);
        expect(issues).toEqual([]);
        expect({ k: back.drugKey, s: back.strength, f: back.frequency, st: back.status }).toEqual({ k: entry.drugKey, s: entry.strength, f: entry.frequency, st: entry.status });
      }),
      opts(),
    );
  });

  // Validates: formulary-normaliser 2.2, 2.3, 2.4
  it('P-N2 name robustness', () => {
    fc.assert(
      fc.property(genFormularyItem.chain((item) => fc.tuple(fc.constant(item.id), fc.constantFrom(...item.aliases).chain(genMessyAlias))), ([id, name]) => {
        expect(mapDrug(name, undefined, formulary)).toBe(id);
      }),
      opts(),
    );
  });

  // Validates: formulary-normaliser 3.2
  it('P-N3 unit equivalence', () => {
    const mass = formulary.items.filter((i) => i.canonicalUnit === 'mg' || i.canonicalUnit === 'mcg');
    fc.assert(
      fc.property(fc.constantFrom(...mass).chain((item) => fc.tuple(fc.constant(item), fc.constantFrom(...item.strengths), fc.constantFrom('mg', 'mcg', 'ug', 'µg', 'g'))), ([item, values, spelling]) => {
        const inMg = values.map((v) => (item.canonicalUnit === 'mcg' ? v / 1000 : v));
        const factor = spelling === 'g' ? 1 / 1000 : spelling === 'mg' ? 1 : 1000;
        const expressed = inMg.map((v) => v * factor);
        fc.pre(expressed.every((v) => Number(v.toFixed(6)) === v && v >= 1e-6)); // exact in six decimals
        const text = expressed.map((v) => String(v)).join('/') + ' ' + spelling;
        expect(parseStrength(text, item.canonicalUnit)).toEqual({ values, unit: item.canonicalUnit });
      }),
      opts(),
    );
  });

  // Validates: formulary-normaliser 4.1, 4.2, 4.3, 4.4, 4.5
  it('P-N4 frequency synonyms', () => {
    const classes = Object.entries(FREQUENCY_SYNONYMS).flatMap(([cls, ps]) => ps.map((p) => [cls, p] as const));
    fc.assert(
      fc.property(fc.constantFrom(...classes), fc.array(fc.constantFrom(0, 1), { minLength: 3, maxLength: 4 }), ([cls, phrase], bits) => {
        expect(formatFrequency(parseFrequency(phrase.toUpperCase() + '.'))).toBe(cls === 'prn' ? 'prn' : `${cls}/day`);
        const sum = bits.reduce<number>((a, b) => a + b, 0);
        expect(formatFrequency(parseFrequency(bits.join('-')))).toBe(sum >= 1 && sum <= 4 ? `${sum}/day` : 'null');
      }),
      opts(),
    );
  });

  // Validates: formulary-normaliser 2.5, 3.6, 4.6, 5.3, 6.5
  it('P-N5 totality and honesty', () => {
    const anyText = fc.oneof(fc.string(), fc.string({ unit: 'grapheme' }), fc.string({ unit: 'binary', maxLength: 300 }), fc.constant(''));
    fc.assert(
      fc.property(fc.record({ name: anyText, form: fc.option(anyText, { nil: undefined }), strength: fc.option(anyText, { nil: undefined }), frequency: fc.option(anyText, { nil: undefined }), status: fc.option(anyText, { nil: undefined }) }), (raw) => {
        const { entry, issues } = normaliseItem(raw, formulary);
        const codes = issues.map((i) => i.code);
        if (entry.strength === null) expect(codes).toContain('UNPARSED_STRENGTH');
        if (entry.frequency === null) expect(codes).toContain('UNPARSED_FREQUENCY');
        if (entry.drugKey.startsWith('unmapped:')) expect(codes).toContain('UNMAPPED_DRUG');
        for (const c of codes) expect(ISSUE_CODES).toContain(c);
      }),
      opts(),
    );
  });

  // Validates: formulary-normaliser 2.6
  it('P-N6 no near-match guessing', () => {
    const single = formulary.aliases.filter((a) => a.tokens.length === 1).map((a) => a.tokens[0] ?? '');
    fc.assert(
      fc.property(fc.constantFrom(...single), fc.nat(), fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), (alias, pos, ch) => {
        const i = pos % alias.length;
        const changed = alias.slice(0, i) + ch + alias.slice(i + 1);
        fc.pre(changed !== alias && !allAliases.has(norm(changed)));
        expect(mapDrug(changed, undefined, formulary)).toBeNull();
      }),
      opts(),
    );
  });
});
