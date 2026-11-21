/**
 * The single reducer. Pure: no clock (time arrives in actions), no random numbers, no storage, no network.
 * Every decision and sign-off goes through core validation; on error the state is unchanged except lastError.
 * Validates: review-ui 2.1, 2.3, 2.4, 2.5
 */
import {
  commitDraft,
  fixedClock,
  normaliseSourceList,
  replayPriorCommits,
  validateResolution,
  type ConflictId,
  type Formulary,
  type NormIssue,
  type RawSourceList,
  type Role,
  type SourceList,
} from '@core';
import { copy, roleLabel } from '../copy';
import { scenarioById } from '../data';
import { shortId } from '../format';
import { derive, head } from './derive';
import type { Action, AppState } from './types';

export const DEMO_NAMES: Record<Role, string> = { clinician: 'Demo Clinician', pharmacist: 'Demo Pharmacist' };

export function initialState(): AppState {
  return {
    view: 'start',
    role: 'clinician',
    scenarioId: null,
    scenarioTitle: null,
    patient: null,
    syntheticNotice: null,
    rawSources: [],
    sources: [],
    issues: {},
    history: [],
    resolutions: [],
    ui: {
      selectedConflictId: null,
      filter: 'all',
      boardView: 'chart',
      commitMessage: '',
      historySelection: null,
      lastCommitId: null,
      fhirReady: false,
    },
    lastError: null,
    announcement: null,
  };
}

function announce(state: AppState, text: string): AppState['announcement'] {
  return { id: (state.announcement?.id ?? 0) + 1, text };
}

function normaliseAll(raw: RawSourceList[], formulary: Formulary): { sources: SourceList[]; issues: Record<string, NormIssue[]> } {
  const sources: SourceList[] = [];
  const issues: Record<string, NormIssue[]> = {};
  for (const r of raw) {
    const n = normaliseSourceList(r, formulary);
    sources.push(n.list);
    if (n.issues.length) issues[r.id] = n.issues;
  }
  return { sources, issues };
}

function openCase(state: AppState, fields: Partial<AppState>, opened: string): AppState {
  const next: AppState = { ...state, ...fields, resolutions: fields.resolutions ?? [], lastError: null };
  const d = derive(next);
  const firstOpen = d.merge?.conflicts.find((c) => d.draft?.states[c.id] === 'open' || d.draft?.states[c.id] === 'escalated');
  return {
    ...next,
    view: 'reconcile',
    ui: {
      ...initialState().ui,
      boardView: 'chart',
      selectedConflictId: firstOpen?.id ?? d.merge?.conflicts[0]?.id ?? null,
      fhirReady: fields.ui?.fhirReady ?? false,
    },
    announcement: announce(state, copy.announce.opened(opened, d.draft?.pendingCount ?? 0)),
  };
}

function drugName(state: AppState, conflictId: ConflictId): string {
  const d = derive(state);
  const c = d.merge?.conflicts.find((x) => x.id === conflictId);
  return c?.claims.find((x) => x.entry)?.entry?.displayName ?? conflictId;
}

export function makeReducer(formulary: Formulary) {
  return function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
      case 'LOAD_SCENARIO': {
        const sc = action.scenario;
        const { sources, issues } = normaliseAll(sc.sources, formulary);
        return openCase(
          state,
          {
            scenarioId: sc.id,
            scenarioTitle: sc.title,
            patient: { ...sc.patient },
            syntheticNotice: sc.syntheticNotice,
            rawSources: sc.sources,
            sources,
            issues,
            history: replayPriorCommits(sc.priorCommits, formulary),
          },
          sc.title,
        );
      }
      case 'IMPORT_CASEFILE': {
        const cs = action.state;
        const { sources, issues } = normaliseAll(cs.rawSources, formulary);
        const title = scenarioById(cs.scenarioId)?.title ?? cs.patient.label;
        const opened = openCase(
          state,
          {
            scenarioId: cs.scenarioId,
            scenarioTitle: title,
            patient: { ...cs.patient },
            syntheticNotice: cs.syntheticNotice,
            rawSources: cs.rawSources,
            sources,
            issues,
            history: cs.history,
            resolutions: cs.resolutions,
            ui: { ...initialState().ui, fhirReady: cs.history.length > 0 },
          },
          title,
        );
        return { ...opened, announcement: announce(state, `${copy.announce.imported} ${opened.announcement?.text ?? ''}`) };
      }
      case 'IMPORT_FAILED':
        return { ...state, lastError: { code: action.code, where: 'import', ...(action.message !== undefined ? { message: action.message } : {}) } };
      case 'SET_ROLE':
        if (action.role === state.role) return state;
        return { ...state, role: action.role, announcement: announce(state, copy.role.announce(roleLabel(action.role))) };
      case 'SET_VIEW':
        if (action.view !== 'start' && state.sources.length === 0) return { ...state, view: 'start' };
        return { ...state, view: action.view, ui: action.view === 'history' && !state.ui.historySelection ? { ...state.ui, historySelection: head(state.history)?.id ?? null } : state.ui };
      case 'SELECT_CONFLICT':
        return { ...state, ui: { ...state.ui, selectedConflictId: action.id }, lastError: state.lastError?.where === 'strip' ? null : state.lastError };
      case 'SET_FILTER':
        return { ...state, ui: { ...state.ui, filter: action.filter } };
      case 'SET_BOARD_VIEW':
        return { ...state, ui: { ...state.ui, boardView: action.view } };
      case 'RESOLVE': {
        const d = derive(state);
        if (!d.merge) return { ...state, lastError: { code: d.mergeError?.code ?? 'generic', where: 'merge' } };
        const candidate = {
          conflictId: action.conflictId,
          decision: action.decision,
          reasonCode: action.reasonCode,
          by: { role: state.role, name: DEMO_NAMES[state.role] },
          at: action.at,
          ...(action.note !== undefined && action.note !== '' ? { note: action.note } : {}),
        };
        const r = validateResolution(d.merge, d.events, candidate);
        if (!r.ok) return { ...state, lastError: { code: r.error.code, message: r.error.message, where: 'strip', conflictId: action.conflictId } };
        const next: AppState = { ...state, resolutions: [...state.resolutions, r.value], lastError: null };
        const pending = derive(next).draft?.pendingCount ?? 0;
        const name = drugName(state, action.conflictId);
        const kind = d.merge.conflicts.find((c) => c.id === action.conflictId)?.kind ?? 'DOSE';
        const text =
          action.decision.type === 'escalate' ? copy.announce.escalated(name, pending) : copy.announce.decided(name, copy.kind[kind], pending);
        return { ...next, announcement: announce(state, text) };
      }
      case 'UNDO_LAST': {
        const d = derive(state);
        const events = d.events.filter((e) => e.conflictId === action.conflictId).sort((a, b) => a.seq - b.seq);
        const previous = events[events.length - 2];
        if (!previous) return state;
        return reducer(state, {
          type: 'RESOLVE',
          conflictId: action.conflictId,
          decision: previous.decision,
          reasonCode: previous.reasonCode,
          ...(previous.note !== undefined ? { note: previous.note } : {}),
          at: action.at,
        });
      }
      case 'SET_COMMIT_MESSAGE':
        return { ...state, ui: { ...state.ui, commitMessage: action.text }, lastError: state.lastError?.where === 'commit' ? null : state.lastError };
      case 'COMMIT': {
        const d = derive(state);
        if (!d.merge || !d.draft) return { ...state, lastError: { code: d.mergeError?.code ?? 'UNRESOLVED_CONFLICTS', where: 'commit' } };
        const r = commitDraft({
          merge: d.merge,
          draft: d.draft,
          parent: head(state.history),
          message: state.ui.commitMessage,
          author: { role: state.role, name: DEMO_NAMES[state.role] },
          clock: fixedClock(action.at),
        });
        if (!r.ok) return { ...state, lastError: { code: r.error.code, where: 'commit' } };
        return {
          ...state,
          history: [...state.history, r.value],
          resolutions: [],
          lastError: null,
          ui: { ...state.ui, commitMessage: '', lastCommitId: r.value.id, historySelection: r.value.id, fhirReady: true },
          announcement: announce(state, copy.announce.committed(shortId(r.value.id))),
        };
      }
      case 'RESET_CASE':
        return { ...initialState(), role: state.role, announcement: state.announcement };
      case 'SET_HISTORY_SELECTION':
        return { ...state, ui: { ...state.ui, historySelection: action.id } };
      case 'CLEAR_ERROR':
        return { ...state, lastError: null };
      default:
        return state;
    }
  };
}
