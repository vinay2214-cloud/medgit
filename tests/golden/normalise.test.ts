import { describe, expect, it } from 'vitest';
import { compareCodeUnits, formatEntry, normaliseItem, normaliseSourceList } from '@core';
import { formulary, scenarios } from '../helpers/data';

describe('golden: normaliser against scenario fixtures', () => {
  for (const sc of scenarios) {
    // Validates: formulary-normaliser 6.6
    it(`${sc.id}: normalised value strings and issue codes match expected`, () => {
      const normalised: Record<string, Record<string, string>> = {};
      const issues: Record<string, string[]> = {};
      for (const src of sc.sources) {
        const { list, issues: iss } = normaliseSourceList(src, formulary);
        normalised[src.id] = Object.fromEntries(list.entries.map((e) => [e.drugKey, formatEntry(e)]));
        const codes = [...new Set(iss.map((i) => i.code))].sort(compareCodeUnits);
        if (codes.length) issues[src.id] = codes;
      }
      expect(normalised).toEqual(sc.expected.normalised);
      expect(issues).toEqual(sc.expected.issues);
    });
  }

  // Probes cross-checked with: python3 docs/reference/reference.py --item "<text>"
  // Validates: formulary-normaliser 2.4, 3.5, 6.6
  it.each([
    ['Glucophage 500 BD', 'metformin-tab', 'null|null|active'],
    ['Dolo 650', 'paracetamol-tab', 'null|null|active'],
    ['Metformin 500 mg tab', 'metformin-tab', '500 mg|null|active'],
    ['Asthalin inhaler 100 mcg', 'salbutamol-inhaler', '100 mcg|null|active'],
    ['Thyronorm 0.05 mg', 'levothyroxine-tab', '50 mcg|null|active'],
  ])('probe %s', (name, key, summary) => {
    const { entry } = normaliseItem({ name }, formulary);
    expect(entry.drugKey).toBe(key);
    expect(formatEntry(entry)).toBe(summary);
  });
});
