/**
 * Item and source-list normalisation, value strings and rendering.
 * Validates formulary-normaliser 2.4, 2.5, 3.5, 3.7, 6.1 to 6.5, 7.1, 7.2.
 */

import { compareCodeUnits, norm } from '../text';
import type {
  EntryFlag,
  Formulary,
  IssueCode,
  MedEntry,
  NormIssue,
  RawItem,
  RawSourceList,
  SourceList,
  Strength,
  Unit,
} from '../types';
import { formatFrequency, parseFrequency } from './frequency';
import { mapDrug } from './mapDrug';
import { formatStrength, parseStrength } from './strength';
import { parseStatus } from './status';

export { mapDrug } from './mapDrug';
export { parseStrength, formatStrength, round6 } from './strength';
export { parseFrequency, formatFrequency, FREQUENCY_SYNONYMS } from './frequency';
export { parseStatus, STATUS_SYNONYMS } from './status';

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function isBlank(v: string | undefined): boolean {
  return v === undefined || v.trim() === '';
}

function strengthListed(s: Strength, listed: number[][]): boolean {
  return listed.some((l) => l.length === s.values.length && l.every((v, i) => v === s.values[i]));
}

/** Normalise one raw item. Total: never throws for any input of the right shape. */
export function normaliseItem(raw: RawItem, formulary: Formulary, itemIndex = 0): { entry: MedEntry; issues: NormIssue[] } {
  const name = str(raw.name) ?? '';
  const form = str(raw.form);
  const strengthText = str(raw.strength);
  const frequencyText = str(raw.frequency);
  const statusText = str(raw.status);
  const issues: NormIssue[] = [];

  const id = mapDrug(name, form, formulary);
  const item = id === null ? undefined : formulary.byId.get(id);
  let drugKey: string;
  let displayName: string;
  let unit: Unit | null;
  if (item) {
    drugKey = item.id;
    displayName = item.display;
    unit = item.canonicalUnit;
  } else {
    drugKey = `unmapped:${norm(name).replace(/ /g, '-')}`;
    displayName = name.trim();
    unit = null;
    issues.push({ code: 'UNMAPPED_DRUG', itemIndex, field: 'name', text: name });
  }

  let strength = parseStrength(strengthText, unit);
  if (strength === null && isBlank(strengthText)) strength = parseStrength(name, unit);
  if (strength === null) {
    issues.push({ code: 'UNPARSED_STRENGTH', itemIndex, field: 'strength', text: isBlank(strengthText) ? name : (strengthText ?? '') });
  } else if (item && !strengthListed(strength, item.strengths)) {
    issues.push({ code: 'STRENGTH_NOT_IN_FORMULARY', itemIndex, field: 'strength', text: strengthText ?? name });
  }

  const frequency = parseFrequency(frequencyText);
  if (frequency === null) issues.push({ code: 'UNPARSED_FREQUENCY', itemIndex, field: 'frequency', text: frequencyText ?? '' });

  const st = parseStatus(statusText);
  if (st.issue) issues.push({ code: st.issue, itemIndex, field: 'status', text: statusText ?? '' });

  const flags = [...new Set(issues.map((i) => i.code as EntryFlag))].sort(compareCodeUnits);
  return { entry: { drugKey, displayName, strength, frequency, status: st.status, flags }, issues };
}

/**
 * Normalise a whole source list: keep the first item of each drugKey, report later ones as
 * DUPLICATE_DRUG (blocking: the list becomes invalid), sort entries by drugKey.
 */
export function normaliseSourceList(raw: RawSourceList, formulary: Formulary): { list: SourceList; issues: NormIssue[] } {
  const byKey = new Map<string, MedEntry>();
  const issues: NormIssue[] = [];
  const items = Array.isArray(raw.items) ? raw.items : [];
  items.forEach((item, index) => {
    const { entry, issues: itemIssues } = normaliseItem(item, formulary, index);
    if (byKey.has(entry.drugKey)) {
      issues.push({ code: 'DUPLICATE_DRUG', itemIndex: index, field: 'name', text: str(item.name) ?? '' });
      return;
    }
    byKey.set(entry.drugKey, entry);
    issues.push(...itemIssues);
  });
  const entries = [...byKey.values()].sort((a, b) => compareCodeUnits(a.drugKey, b.drugKey));
  const valid = !issues.some((i) => i.code === 'DUPLICATE_DRUG');
  return { list: { id: raw.id, label: raw.label, kind: raw.kind, asOf: raw.asOf, entries, valid }, issues };
}

/** Value string "<strength>|<frequency>|<status>", for example "500 mg|2/day|active". */
export function formatEntry(e: Pick<MedEntry, 'strength' | 'frequency' | 'status'>): string {
  return `${formatStrength(e.strength)}|${formatFrequency(e.frequency)}|${e.status}`;
}

/** Turn an entry back into a raw item that normalises to the same values (for mapped drugs). */
export function renderRaw(entry: MedEntry): RawItem {
  const raw: RawItem = { name: entry.displayName };
  if (entry.strength !== null) raw.strength = formatStrength(entry.strength);
  if (entry.frequency !== null) raw.frequency = entry.frequency.kind === 'prn' ? 'PRN' : `${entry.frequency.perDay}/day`;
  raw.status = entry.status; // "on-hold" normalises to "on hold"
  return raw;
}

export const ISSUE_CODES: readonly IssueCode[] = [
  'UNMAPPED_DRUG',
  'UNPARSED_STRENGTH',
  'STRENGTH_NOT_IN_FORMULARY',
  'UNPARSED_FREQUENCY',
  'UNPARSED_STATUS',
  'DUPLICATE_DRUG',
];
