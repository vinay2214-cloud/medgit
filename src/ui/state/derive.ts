/**
 * Derivations shared by the reducer and the selectors. Pure; built only from core functions.
 *
 * Carried decisions: when the head commit already signed off exactly the current source lists
 * (same ids and as-of dates in `sourcesSeen`), the head's decisions still apply to the same
 * disagreements, so they are carried into the draft. The sources keep showing what they really say;
 * the rows read "Decided" with the head's reasons, and nothing is left to decide.
 */
import {
  applyResolutions,
  mergeSources,
  type Commit,
  type Draft,
  type MergeError,
  type MergeResult,
  type Resolution,
  type SourceList,
} from '@core';
import type { AppState } from './types';

export function head(history: Commit[]): Commit | null {
  return history[history.length - 1] ?? null;
}

export function headCoversSources(h: Commit | null, sources: SourceList[]): boolean {
  if (!h || h.sourcesSeen.length === 0 || h.sourcesSeen.length !== sources.length) return false;
  const seen = new Map(h.sourcesSeen.map((s) => [s.id, s.asOf]));
  return sources.every((s) => seen.get(s.id) === s.asOf);
}

export function carriedResolutions(history: Commit[], sources: SourceList[]): Resolution[] {
  const h = head(history);
  if (!h || !headCoversSources(h, sources)) return [];
  return h.resolutions.map((r) => {
    const { manual: _manual, ...event } = r;
    void _manual;
    return event;
  });
}

export interface Derived {
  merge: MergeResult | null;
  mergeError: MergeError | null;
  /** Carried decisions followed by working events; the input to validation and the draft. */
  events: Resolution[];
  carriedCount: number;
  draft: Draft | null;
}

export function derive(state: Pick<AppState, 'sources' | 'history' | 'resolutions'>): Derived {
  if (state.sources.length === 0) return { merge: null, mergeError: null, events: [], carriedCount: 0, draft: null };
  const m = mergeSources(state.sources, head(state.history));
  if (!m.ok) return { merge: null, mergeError: m.error, events: [], carriedCount: 0, draft: null };
  const carried = carriedResolutions(state.history, state.sources);
  const events = [...carried, ...state.resolutions];
  return { merge: m.value, mergeError: null, events, carriedCount: carried.length, draft: applyResolutions(m.value, events) };
}
