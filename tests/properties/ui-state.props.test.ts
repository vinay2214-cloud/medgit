import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { formatEntry, validateResolution, verifyChain, type ConflictId, type Decision, type ReasonCode, type Role } from '@core';
import { formulary, scenarios } from '@ui/data';
import { derive } from '@ui/state/derive';
import { initialState, makeReducer } from '@ui/state/reducer';
import { selectChartRows, selectCounters, selectMergedLines } from '@ui/state/selectors';
import type { Action, AppState } from '@ui/state/types';
import { runs } from '../helpers/fc';

const reducer = makeReducer(formulary);
const opts = () => ({ numRuns: runs(), verbose: 1 as const });

const REASONS: ReasonCode[] = ['VERIFIED_WITH_PRESCRIBER', 'CONFIRMED_WITH_PATIENT', 'PER_DISPENSING_RECORD', 'PER_DISCHARGE_SUMMARY', 'CLINICAL_JUDGEMENT', 'NEEDS_PHARMACIST_REVIEW'];
const SOURCES = ['hospital', 'gp', 'pharmacy', 'patient', 'nobody'];
const genDecision: fc.Arbitrary<Decision> = fc.oneof(
  fc.constantFrom<Decision>({ type: 'include' }, { type: 'exclude' }, { type: 'escalate' }, { type: 'custom', value: 'stopped' }, { type: 'custom', value: { kind: 'prn' } }, { type: 'custom', value: { values: [5], unit: 'mg' } }),
  fc.constantFrom(...SOURCES).map((source): Decision => ({ type: 'choose', source })),
);

/** An abstract step; the conflict is chosen by index into the current merge so valid and invalid actions both occur. */
type Step =
  | { k: 'resolve'; conflict: number; decision: Decision; reason: ReasonCode }
  | { k: 'role'; role: Role }
  | { k: 'commit'; message: string }
  | { k: 'undo'; conflict: number };

const genStep: fc.Arbitrary<Step> = fc.oneof(
  { weight: 6, arbitrary: fc.record({ k: fc.constant('resolve' as const), conflict: fc.nat(10), decision: genDecision, reason: fc.constantFrom(...REASONS) }) },
  { weight: 2, arbitrary: fc.record({ k: fc.constant('role' as const), role: fc.constantFrom<Role>('clinician', 'pharmacist') }) },
  { weight: 2, arbitrary: fc.record({ k: fc.constant('commit' as const), message: fc.constantFrom('', '  ', 'Sign off', 'm'.repeat(201)) }) },
  { weight: 1, arbitrary: fc.record({ k: fc.constant('undo' as const), conflict: fc.nat(10) }) },
);

const genRun = fc.record({ scenario: fc.constantFrom(...scenarios), steps: fc.array(genStep, { maxLength: 30 }) });

function toAction(state: AppState, step: Step, i: number): Action {
  const at = `2026-11-20T10:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`;
  const conflicts = derive(state).merge?.conflicts ?? [];
  const pick = (n: number): ConflictId => conflicts[n % Math.max(conflicts.length, 1)]?.id ?? ('none::DOSE' as ConflictId);
  switch (step.k) {
    case 'resolve':
      return { type: 'RESOLVE', conflictId: pick(step.conflict), decision: step.decision, reasonCode: step.reason, at };
    case 'role':
      return { type: 'SET_ROLE', role: step.role };
    case 'undo':
      return { type: 'UNDO_LAST', conflictId: pick(step.conflict), at };
    case 'commit':
      return { type: 'COMMIT', at };
  }
}

/** Run a generated sequence, checking a per-step invariant. */
function play(run: { scenario: (typeof scenarios)[number]; steps: Step[] }, check: (before: AppState, action: Action, after: AppState) => void): AppState {
  let state = reducer(initialState(), { type: 'LOAD_SCENARIO', scenario: run.scenario });
  run.steps.forEach((step, i) => {
    if (step.k === 'commit') state = reducer(state, { type: 'SET_COMMIT_MESSAGE', text: step.message });
    const action = toAction(state, step, i);
    const next = reducer(state, action);
    check(state, action, next);
    state = next;
  });
  return state;
}

describe('review-ui state properties', () => {
  // Validates: review-ui 2.4, 2.5
  it('P-U1 state safety', () => {
    fc.assert(
      fc.property(genRun, (r) => {
        const end = play(r, (before, action, after) => {
          if (action.type !== 'COMMIT') return;
          const d = derive(before);
          if (!d.draft?.canCommit) expect(after.history).toBe(before.history);
          if (after.history.length > before.history.length) {
            // the new commit covers every conflict of the merge it was made from
            const c = after.history[after.history.length - 1];
            const decided = new Set(c?.resolutions.map((x) => x.conflictId));
            const excluded = new Set(d.draft?.excluded);
            for (const conflict of d.merge?.conflicts ?? []) {
              expect(decided.has(conflict.id) || (conflict.kind !== 'OMISSION' && excluded.has(conflict.drugKey))).toBe(true);
            }
            expect(after.resolutions).toEqual([]);
          }
        });
        expect(verifyChain(end.history).ok).toBe(true);
      }),
      opts(),
    );
  });

  // Validates: review-ui 2.3
  it('P-U2 invalid decisions change nothing', () => {
    fc.assert(
      fc.property(genRun, (r) => {
        play(r, (before, action, after) => {
          if (action.type !== 'RESOLVE') return;
          const d = derive(before);
          if (!d.merge) return;
          const v = validateResolution(d.merge, d.events, { conflictId: action.conflictId, decision: action.decision, reasonCode: action.reasonCode, by: { role: before.role }, at: action.at });
          if (!v.ok) {
            expect(after.resolutions).toEqual(before.resolutions);
            expect(after.history).toBe(before.history);
            expect(after.lastError?.code).toBe(v.error.code);
          } else {
            expect(after.resolutions).toHaveLength(before.resolutions.length + 1);
          }
        });
      }),
      opts(),
    );
  });

  // Validates: review-ui 3.2, 7.4
  it('P-U3 view agrees with core', () => {
    fc.assert(
      fc.property(genRun, (r) => {
        play(r, (_b, _a, s) => {
          const d = derive(s);
          if (!d.merge || !d.draft) return;
          const states = Object.values(d.draft.states);
          expect(selectCounters(d)).toEqual({ toDecide: states.filter((x) => x === 'open').length, escalated: states.filter((x) => x === 'escalated').length, agreed: d.merge.clean.length });
          const m = selectMergedLines(d);
          expect(m.lines.map((l) => l.entry)).toEqual(d.draft.entries);
          expect(m.waiting.map((w) => w.drugKey)).toEqual(d.draft.pendingDrugKeys);
          // every cell value is what that source holds: in a claim or in the clean entry
          for (const row of selectChartRows(s, d)) {
            for (const cell of row.cells) {
              if (!cell.entry) continue;
              const held = s.sources.find((x) => x.id === cell.sourceId)?.entries.find((e) => e.drugKey === row.drugKey);
              expect(held && formatEntry(held)).toBe(formatEntry(cell.entry));
            }
          }
        });
      }),
      opts(),
    );
  });
});
