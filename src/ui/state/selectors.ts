/**
 * Pure view-model builders over the state and the derived merge and draft.
 * They never put a value on screen that the core did not produce.
 * Validates: review-ui 2.2
 */
import {
  blame,
  compareCodeUnits,
  diffCommits,
  effectiveResolutions,
  log,
  verifyChain,
  type BlameLine,
  type Commit,
  type CommitDiff,
  type Conflict,
  type ConflictId,
  type ConflictKind,
  type ConflictState,
  type EntryField,
  type LogLine,
  type MedEntry,
  type MergeSourceInfo,
  type NormIssue,
  type ReasonCode,
  type Resolution,
} from '@core';
import type { Derived } from './derive';
import type { AppState, Filter } from './types';

export type RowState = 'agreed' | 'open' | 'escalated' | 'resolved' | 'superseded';
export type CellMark = EntryField | 'omission';

export interface ChartCell {
  sourceId: string;
  entry: MedEntry | null;
  inConflict: CellMark[];
  chosen: EntryField[];
}

export interface ChartRow {
  drugKey: string;
  displayName: string;
  rowState: RowState;
  conflicts: { id: ConflictId; kind: ConflictKind; state: ConflictState }[];
  cells: ChartCell[];
}

export interface Counters {
  toDecide: number;
  escalated: number;
  agreed: number;
}

export function selectCounters(d: Derived): Counters {
  const states = Object.values(d.draft?.states ?? {});
  return {
    toDecide: states.filter((s) => s === 'open').length,
    escalated: states.filter((s) => s === 'escalated').length,
    agreed: d.merge?.clean.length ?? 0,
  };
}

function fieldOf(kind: ConflictKind): EntryField | null {
  return kind === 'DOSE' ? 'strength' : kind === 'FREQUENCY' ? 'frequency' : kind === 'STATUS' ? 'status' : null;
}

export function selectChartRows(state: Pick<AppState, 'sources'>, d: Derived): ChartRow[] {
  const merge = d.merge;
  const draft = d.draft;
  if (!merge || !draft) return [];
  const lists = new Map(state.sources.map((s) => [s.id, new Map(s.entries.map((e) => [e.drugKey, e]))]));
  const byDrug = new Map<string, Conflict[]>();
  for (const c of merge.conflicts) byDrug.set(c.drugKey, [...(byDrug.get(c.drugKey) ?? []), c]);
  const eff = effectiveResolutions(d.events);
  const excluded = new Set(draft.excluded);

  const keys = [...new Set([...merge.clean.map((c) => c.entry.drugKey), ...byDrug.keys()])];
  const rows: ChartRow[] = keys.map((drugKey) => {
    const conflicts = byDrug.get(drugKey) ?? [];
    const cleanEntry = merge.clean.find((c) => c.entry.drugKey === drugKey)?.entry;
    const displayName = cleanEntry?.displayName ?? conflicts.flatMap((c) => c.claims).find((c) => c.entry)?.entry?.displayName ?? drugKey;
    const cstates = conflicts.map((c) => ({ id: c.id, kind: c.kind, state: draft.states[c.id] ?? 'open' }));
    let rowState: RowState = 'agreed';
    if (conflicts.length) {
      if (cstates.some((c) => c.state === 'open')) rowState = 'open';
      else if (cstates.some((c) => c.state === 'escalated')) rowState = 'escalated';
      else if (excluded.has(drugKey)) rowState = 'superseded';
      else rowState = 'resolved';
    }
    const cells: ChartCell[] = merge.sources.map((s) => {
      const entry = lists.get(s.id)?.get(drugKey) ?? null;
      const inConflict: CellMark[] = [];
      const chosen: EntryField[] = [];
      for (const c of conflicts) {
        const f = fieldOf(c.kind);
        if (f === null) {
          if (entry === null) inConflict.push('omission');
        } else if (entry !== null) {
          inConflict.push(f);
          const r = eff.get(c.id);
          if (draft.states[c.id] === 'resolved' && r?.decision.type === 'choose' && r.decision.source === s.id) chosen.push(f);
        }
      }
      return { sourceId: s.id, entry, inConflict, chosen };
    });
    return { drugKey, displayName, rowState, conflicts: cstates, cells };
  });
  return rows.sort((a, b) => compareCodeUnits(a.displayName.toLowerCase(), b.displayName.toLowerCase()) || compareCodeUnits(a.drugKey, b.drugKey));
}

export function filterRows(rows: ChartRow[], filter: Filter): ChartRow[] {
  if (filter === 'all') return rows;
  if (filter === 'open') return rows.filter((r) => r.rowState === 'open');
  if (filter === 'escalated') return rows.filter((r) => r.rowState === 'escalated');
  return rows.filter((r) => r.rowState === 'resolved' || r.rowState === 'superseded');
}

/** Next row (after fromDrugKey, wrapping) that is open or escalated. */
export function nextOpenRow(rows: ChartRow[], fromDrugKey: string | null): ChartRow | null {
  const pending = (r: ChartRow) => r.rowState === 'open' || r.rowState === 'escalated';
  const start = rows.findIndex((r) => r.drugKey === fromDrugKey);
  for (let i = 1; i <= rows.length; i++) {
    const r = rows[(start + i + rows.length) % rows.length];
    if (r && pending(r)) return r;
  }
  return null;
}

/** First open conflict of a row, else its first conflict. */
export function rowConflictToSelect(row: ChartRow): ConflictId | null {
  return (row.conflicts.find((c) => c.state === 'open') ?? row.conflicts.find((c) => c.state === 'escalated') ?? row.conflicts[0])?.id ?? null;
}

export type Provenance = { kind: 'agreed' } | { kind: 'decided'; reason: ReasonCode } | { kind: 'manual' };

export interface MergedLine {
  entry: MedEntry;
  provenance: Provenance;
}

export interface MergedView {
  lines: MergedLine[];
  waiting: { drugKey: string; displayName: string }[];
  excludedCount: number;
}

export function selectMergedLines(d: Derived): MergedView {
  const draft = d.draft;
  const merge = d.merge;
  if (!draft || !merge) return { lines: [], waiting: [], excludedCount: 0 };
  const agreed = new Set(merge.clean.map((c) => c.entry.drugKey));
  const lines = draft.entries.map((entry): MergedLine => {
    if (agreed.has(entry.drugKey)) return { entry, provenance: { kind: 'agreed' } };
    const forDrug = draft.effective.filter((r) => r.conflictId.startsWith(`${entry.drugKey}::`) && r.decision.type !== 'escalate');
    if (forDrug.some((r) => r.manual)) return { entry, provenance: { kind: 'manual' } };
    const first = forDrug[0];
    return { entry, provenance: first ? { kind: 'decided', reason: first.reasonCode } : { kind: 'agreed' } };
  });
  const names = new Map(merge.conflicts.map((c) => [c.drugKey, c.claims.find((x) => x.entry)?.entry?.displayName ?? c.drugKey]));
  return {
    lines,
    waiting: draft.pendingDrugKeys.map((k) => ({ drugKey: k, displayName: names.get(k) ?? k })),
    excludedCount: draft.excluded.length,
  };
}

export interface StripView {
  conflict: Conflict;
  drugConflicts: { id: ConflictId; kind: ConflictKind; state: ConflictState }[];
  displayName: string;
  state: ConflictState;
  sources: MergeSourceInfo[];
  effective: Resolution | null;
  events: Resolution[];
  mayDecide: boolean;
  canUndo: boolean;
}

export function selectStrip(state: Pick<AppState, 'ui' | 'role'>, d: Derived): StripView | null {
  const id = state.ui.selectedConflictId;
  const merge = d.merge;
  const draft = d.draft;
  if (!id || !merge || !draft) return null;
  const conflict = merge.conflicts.find((c) => c.id === id);
  if (!conflict) return null;
  const st = draft.states[id] ?? 'open';
  const events = d.events.filter((e) => e.conflictId === id).sort((a, b) => a.seq - b.seq);
  return {
    conflict,
    drugConflicts: merge.conflicts.filter((c) => c.drugKey === conflict.drugKey).map((c) => ({ id: c.id, kind: c.kind, state: draft.states[c.id] ?? 'open' })),
    displayName: conflict.claims.find((c) => c.entry)?.entry?.displayName ?? conflict.drugKey,
    state: st,
    sources: merge.sources,
    effective: events[events.length - 1] ?? null,
    events,
    mayDecide: st !== 'superseded' && (st !== 'escalated' || state.role === 'pharmacist'),
    canUndo: events.length > 1,
  };
}

export interface HistoryView {
  log: LogLine[];
  chain: { ok: true } | { ok: false; index: number };
  selected: Commit | null;
  selectedIndex: number;
  diff: CommitDiff | null;
  blame: BlameLine[];
}

export function selectHistoryView(state: Pick<AppState, 'history' | 'ui'>): HistoryView {
  const h = state.history;
  const v = verifyChain(h);
  const idx = Math.max(0, h.findIndex((c) => c.id === state.ui.historySelection));
  const selected = h.length ? (h[state.ui.historySelection ? idx : h.length - 1] ?? null) : null;
  const selectedIndex = selected ? h.indexOf(selected) : -1;
  return {
    log: log(h),
    chain: v.ok ? { ok: true } : { ok: false, index: v.error.index },
    selected,
    selectedIndex,
    diff: selected ? diffCommits(h[selectedIndex - 1] ?? null, selected) : null,
    blame: selected ? blame(h.slice(0, selectedIndex + 1)) : [],
  };
}

export function selectIssues(state: Pick<AppState, 'issues' | 'rawSources'>): { sourceId: string; label: string; issues: (NormIssue & { name: string })[] }[] {
  return state.rawSources
    .filter((s) => (state.issues[s.id]?.length ?? 0) > 0)
    .map((s) => ({
      sourceId: s.id,
      label: s.label,
      issues: (state.issues[s.id] ?? []).map((i) => ({ ...i, name: s.items[i.itemIndex]?.name ?? '' })),
    }));
}

/** Source ids whose list has an issue for this drug and field (for the "Unreadable" link). */
export function hasIssue(state: Pick<AppState, 'issues' | 'rawSources'>, sourceId: string): boolean {
  return (state.issues[sourceId]?.length ?? 0) > 0;
}
