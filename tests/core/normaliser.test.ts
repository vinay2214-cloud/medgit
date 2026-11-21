import { describe, expect, it } from 'vitest';
import formularyJson from '../../data/formulary.json';
import {
  FREQUENCY_SYNONYMS,
  formatEntry,
  formatFrequency,
  formatStrength,
  loadFormulary,
  mapDrug,
  norm,
  normaliseItem,
  normaliseSourceList,
  parseFrequency,
  parseStatus,
  parseStrength,
  renderRaw,
  STATUS_SYNONYMS,
} from '@core';
import { formulary } from '../helpers/data';

const base = formularyJson as { schema: string; items: Record<string, unknown>[] };

describe('formulary loading', () => {
  // Validates: formulary-normaliser 1.1, 1.4
  it('loads the real formulary with 43 items and orders aliases longest first', () => {
    expect(formulary.items).toHaveLength(43);
    const lens = formulary.aliases.map((a) => a.tokens.length);
    expect(lens).toEqual([...lens].sort((a, b) => b - a));
    const twoTok = formulary.aliases.filter((a) => a.tokens.length === 2).map((a) => a.tokens.join(' '));
    expect(twoTok).toEqual([...twoTok].sort());
  });

  // Validates: formulary-normaliser 1.2
  it.each([
    ['wrong schema', { ...base, schema: 'other/1' }, 'schema'],
    ['empty items', { ...base, items: [] }, 'empty'],
    ['missing field', { ...base, items: [{ ...base.items[0], display: undefined }] }, 'display'],
    ['duplicate id', { ...base, items: [base.items[0], base.items[0]] }, 'share the id'],
    ['bad unit', { ...base, items: [{ ...base.items[0], canonicalUnit: 'g' }] }, 'canonicalUnit'],
    ['not an object', 42, 'not an object'],
  ])('rejects %s', (_n, json, fragment) => {
    const r = loadFormulary(json);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('FORMULARY_INVALID');
      expect(r.error.message).toContain(fragment);
    }
  });

  // Validates: formulary-normaliser 1.3
  it('rejects an alias shared by two items after normalisation, naming both', () => {
    const a = { ...base.items[0], id: 'a-tab', aliases: ['Co-Trim'] };
    const b = { ...base.items[1], id: 'b-tab', aliases: ['co trim'] };
    const r = loadFormulary({ ...base, items: [a, b] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/a-tab.*b-tab.*co trim/);
  });
});

describe('text normalisation', () => {
  // Validates: formulary-normaliser 2.1
  it.each([
    ['  Co-Trimoxazole   DS ', 'co trimoxazole ds'],
    ['GLUCO_phage//500', 'gluco phage 500'],
    ['Vitamin D3 (60,000 IU)', 'vitamin d3 60 000 iu'],
    ['µg é', 'g'],
    ['---', ''],
  ])('norm(%j) is %j', (input, out) => expect(norm(input)).toBe(out));
});

describe('drug mapping', () => {
  // Validates: formulary-normaliser 2.2, 2.3, 2.4
  it.each([
    ['GLUCOPHAGE', 'metformin-tab'],
    ['glucophage', 'metformin-tab'],
    ['  Metformin-HCl  ', 'metformin-tab'],
    ['Co-Trimoxazole DS', 'cotrimoxazole-tab'],
    ['Augmentin 625', 'amoxicillin-clavulanate-tab'],
    ['amoxicillin clavulanate', 'amoxicillin-clavulanate-tab'],
    ['Salbutamol inhaler', 'salbutamol-inhaler'],
  ])('maps %s to %s', (name, id) => expect(mapDrug(name, undefined, formulary)).toBe(id));

  // Validates: formulary-normaliser 2.2
  it('searches the form tokens after the name', () => {
    expect(mapDrug('Salbutamol', 'inhaler', formulary)).toBe('salbutamol-inhaler');
    expect(mapDrug('Salbutamol', 'tab', formulary)).toBeNull();
  });

  // Validates: formulary-normaliser 2.3, 2.6
  it('does not match split tokens or near misses', () => {
    expect(mapDrug('Gluco-phage', undefined, formulary)).toBeNull();
    expect(mapDrug('Metformn', undefined, formulary)).toBeNull();
    expect(mapDrug('Aspirine', undefined, formulary)).toBeNull();
  });

  // Validates: formulary-normaliser 2.5
  it('keeps an unknown drug as unmapped with its raw name and an issue', () => {
    const { entry, issues } = normaliseItem({ name: '  Ashwagandha churna ', strength: '1 tsp', frequency: 'daily' }, formulary);
    expect(entry.drugKey).toBe('unmapped:ashwagandha-churna');
    expect(entry.displayName).toBe('Ashwagandha churna');
    expect(issues.map((i) => i.code)).toEqual(['UNMAPPED_DRUG', 'UNPARSED_STRENGTH']);
  });
});

describe('strength parsing', () => {
  // Validates: formulary-normaliser 3.1, 3.2, 3.3, 3.4, 3.8
  it.each([
    ['500 mg', 'mg', '500 mg'],
    ['500mg.', 'mg', '500 mg'],
    ['500 MG tablets', 'mg', '500 mg'],
    ['1 g', 'mg', '1000 mg'],
    ['0.04 g', 'mg', '40 mg'],
    ['0.05 mg', 'mcg', '50 mcg'],
    ['50 ug', 'mcg', '50 mcg'],
    ['50 µg', 'mcg', '50 mcg'],
    ['50 mcg', 'mg', '0.05 mg'],
    ['800/160mg', 'mg', '800/160 mg'],
    ['800 / 160 mg', 'mg', '800/160 mg'],
    ['0.4 mg', 'mg', '0.4 mg'],
    ['60000 IU', 'iu', '60000 iu'],
    ['5 ml', 'ml', '5 ml'],
  ] as const)('%s with canonical %s gives %s', (text, unit, out) => expect(formatStrength(parseStrength(text, unit))).toBe(out));

  // Validates: formulary-normaliser 3.3, 3.4, 3.6
  it.each([
    ['50 mcg', null, '50 mcg'],
    ['2 g', null, '2000 mg'],
    ['5 ml', null, '5 ml'],
    ['5 ml', 'mg', 'null'],
    ['500 mg', 'iu', 'null'],
    ['1000 iu', 'mg', 'null'],
    ['500 mgs', 'mg', 'null'],
    ['1 tsp', null, 'null'],
    ['', 'mg', 'null'],
  ] as const)('%s with canonical %s gives %s', (text, unit, out) => expect(formatStrength(parseStrength(text, unit))).toBe(out));

  // Validates: formulary-normaliser 3.5, 3.6, 3.7
  it('reads strength from the name when absent, flags unreadable and unlisted values', () => {
    expect(formatEntry(normaliseItem({ name: 'Metformin 500 mg', frequency: 'BD' }, formulary).entry)).toBe('500 mg|2/day|active');
    const blank = normaliseItem({ name: 'Metformin 500 mg', strength: '   ', frequency: 'BD' }, formulary);
    expect(formatEntry(blank.entry)).toBe('500 mg|2/day|active');
    const none = normaliseItem({ name: 'Glucophage 1000', frequency: 'BD' }, formulary);
    expect(none.entry.strength).toBeNull();
    expect(none.issues.map((i) => i.code)).toEqual(['UNPARSED_STRENGTH']);
    const odd = normaliseItem({ name: 'Metformin', strength: '600 mg', frequency: 'BD' }, formulary);
    expect(formatEntry(odd.entry)).toBe('600 mg|2/day|active');
    expect(odd.entry.flags).toEqual(['STRENGTH_NOT_IN_FORMULARY']);
  });
});

describe('frequency parsing', () => {
  // Validates: formulary-normaliser 4.3, 4.4, 4.5
  for (const [cls, phrases] of Object.entries(FREQUENCY_SYNONYMS)) {
    it(`every synonym of class ${cls}`, () => {
      for (const p of phrases) expect(formatFrequency(parseFrequency(p.toUpperCase()))).toBe(cls === 'prn' ? 'prn' : `${cls}/day`);
    });
  }

  // Validates: formulary-normaliser 4.1, 4.2, 4.6, 4.7
  it.each([
    ['1-0-1', '2/day'],
    ['1-1-1-1', '4/day'],
    ['0-0-1', '1/day'],
    ['0-0-0', 'null'],
    ['1-1-1-1-1', 'null'],
    ['2/day', '2/day'],
    ['3 / day', '3/day'],
    ['5/day', 'null'],
    ['B.D.', '2/day'],
    ['as directed', 'null'],
    ['', 'null'],
  ])('%s gives %s', (t, out) => expect(formatFrequency(parseFrequency(t))).toBe(out));
});

describe('status parsing', () => {
  // Validates: formulary-normaliser 5.1, 5.2, 5.3
  it('reads every synonym, defaults blank to active and flags unknown words', () => {
    for (const [status, words] of Object.entries(STATUS_SYNONYMS)) {
      for (const w of words) expect(parseStatus(w.toUpperCase())).toEqual({ status });
    }
    expect(parseStatus(undefined)).toEqual({ status: 'active' });
    expect(parseStatus('  ')).toEqual({ status: 'active' });
    expect(parseStatus('On-Hold')).toEqual({ status: 'on-hold' });
    expect(parseStatus('maybe')).toEqual({ status: 'active', issue: 'UNPARSED_STATUS' });
  });
});

describe('source list normalisation', () => {
  // Validates: formulary-normaliser 6.1, 6.2, 6.3, 6.4
  it('sorts entries, keeps the first duplicate, records issues with index and field, and marks the list invalid', () => {
    const { list, issues } = normaliseSourceList(
      {
        id: 'gp',
        label: 'GP',
        kind: 'prescriber',
        asOf: '2026-11-01',
        items: [
          { name: 'Paracetamol', strength: '500 mg', frequency: 'weekly' },
          { name: 'Aspirin', strength: '75 mg', frequency: 'OD', status: 'unsure' },
          { name: 'Dolo', strength: '650 mg', frequency: 'PRN' },
        ],
      },
      formulary,
    );
    expect(list.entries.map((e) => e.drugKey)).toEqual(['aspirin-tab', 'paracetamol-tab']);
    expect(list.entries[1]?.strength).toEqual({ values: [500], unit: 'mg' });
    expect(list.valid).toBe(false);
    expect(issues).toEqual([
      { code: 'UNPARSED_FREQUENCY', itemIndex: 0, field: 'frequency', text: 'weekly' },
      { code: 'UNPARSED_STATUS', itemIndex: 1, field: 'status', text: 'unsure' },
      { code: 'DUPLICATE_DRUG', itemIndex: 2, field: 'name', text: 'Dolo' },
    ]);
    expect(list.entries[0]?.flags).toEqual(['UNPARSED_STATUS']);
  });

  // Validates: formulary-normaliser 6.5
  it('does not throw for empty, very long and non-Latin strings', () => {
    const long = 'x'.repeat(100_000);
    for (const name of ['', long, 'メトホルミン', '😀😀', '\u0000']) {
      expect(() => normaliseItem({ name, strength: name, frequency: name, status: name, form: name }, formulary)).not.toThrow();
    }
  });
});

describe('rendering', () => {
  // Validates: formulary-normaliser 7.1, 7.2
  it('formats value strings and renders a raw item', () => {
    const { entry } = normaliseItem({ name: 'Septran DS', strength: '800/160 mg', frequency: 'SOS', status: 'held' }, formulary);
    expect(formatEntry(entry)).toBe('800/160 mg|prn|on-hold');
    expect(renderRaw(entry)).toEqual({ name: 'Cotrimoxazole tablet', strength: '800/160 mg', frequency: 'PRN', status: 'on-hold' });
    expect(formatEntry({ strength: null, frequency: null, status: 'active' })).toBe('null|null|active');
  });
});
