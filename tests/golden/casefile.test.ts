import { describe, expect, it } from 'vitest';
import { exportCaseFile, fixedClock, importCaseFile, verifyChain, type CaseState } from '@core';
import { heroAfterCommit, heroScenario, scenarioHistory, scenarios } from '../helpers/data';

function heroState(): CaseState {
  const { history } = heroAfterCommit();
  return {
    scenarioId: 'hero',
    patient: heroScenario.patient,
    syntheticNotice: heroScenario.syntheticNotice,
    rawSources: heroScenario.sources,
    history,
    resolutions: [],
  };
}

describe('golden: case file', () => {
  // Validates: interop-export 1.1, 1.2, 2.1
  it('exports the hero state with schema, key order and notice, and imports it back equal', () => {
    const state = heroState();
    const text = exportCaseFile(state, fixedClock('2026-11-20T10:05:00Z'));
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['schema', 'syntheticNotice', 'exportedAt', 'scenarioId', 'patient', 'sources', 'history', 'resolutions']);
    expect(parsed.schema).toBe('medgit.case/1');
    expect(String(parsed.syntheticNotice)).toContain('SYNTHETIC DATA');
    expect(parsed.exportedAt).toBe('2026-11-20T10:05:00Z');
    expect(text.startsWith('{\n  "schema"')).toBe(true);
    expect(importCaseFile(text)).toEqual({ ok: true, value: state });
  });

  // Validates: interop-export 1.1, 2.1
  it('wraps each scenario as a case state and round-trips it', () => {
    for (const sc of scenarios) {
      const state: CaseState = {
        scenarioId: sc.id,
        patient: sc.patient,
        syntheticNotice: sc.syntheticNotice,
        rawSources: sc.sources,
        history: scenarioHistory(sc),
        resolutions: [],
      };
      expect(importCaseFile(exportCaseFile(state, fixedClock('2026-11-20T10:00:00Z')))).toEqual({ ok: true, value: state });
    }
  });

  // Validates: interop-export 2.5
  it('a tampered commit still imports, but verifyChain then fails at that commit', () => {
    const text = exportCaseFile(heroState(), fixedClock('2026-11-20T10:05:00Z'));
    const file = JSON.parse(text) as { history: { message: string }[] };
    const second = file.history[1];
    if (!second) throw new Error('expected a second commit');
    second.message = 'Edited after sign-off';
    const r = importCaseFile(JSON.stringify(file));
    expect(r.ok).toBe(true);
    if (r.ok) expect(verifyChain(r.value.history)).toEqual({ ok: false, error: { code: 'CHAIN_BROKEN', index: 1 } });
  });
});
