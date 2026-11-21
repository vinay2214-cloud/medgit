/**
 * Small builders for table tests: entries and source lists from compact value strings.
 */
import type { Frequency, MedEntry, SourceList, Status } from '@core';

/** e(key, "500 mg|2/day|active") — strength may be "null", frequency "prn"/"n/day"/"null". */
export function e(drugKey: string, summary: string): MedEntry {
  const [s = 'null', f = 'null', st = 'active'] = summary.split('|');
  let strength: MedEntry['strength'] = null;
  if (s !== 'null') {
    const [vals = '', unit = 'mg'] = s.split(' ');
    strength = { values: vals.split('/').map(Number), unit: unit as 'mg' };
  }
  let frequency: Frequency | null = null;
  if (f === 'prn') frequency = { kind: 'prn' };
  else if (f !== 'null') frequency = { kind: 'scheduled', perDay: Number(f.split('/')[0]) as 1 };
  return { drugKey, displayName: drugKey, strength, frequency, status: st as Status, flags: [] };
}

export function src(id: string, entries: Record<string, string>, valid = true): SourceList {
  return {
    id,
    label: id,
    kind: 'prescriber',
    asOf: '2026-11-01',
    entries: Object.entries(entries)
      .map(([k, v]) => e(k, v))
      .sort((a, b) => (a.drugKey < b.drugKey ? -1 : 1)),
    valid,
  };
}
