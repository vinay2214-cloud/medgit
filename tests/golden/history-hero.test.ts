import { describe, expect, it } from 'vitest';
import { blame, canonicalise, diffCommits, formatEntry, log, sha256Hex, verifyChain, type Commit } from '@core';
import { heroAfterCommit, heroScenario, scenarioHistory } from '../helpers/data';

function independentId(c: Commit): string {
  const { id: _id, ...body } = c;
  void _id;
  const text = canonicalise(JSON.parse(JSON.stringify(body)));
  if (!text.ok) throw new Error('not canonical');
  return sha256Hex(text.value);
}

describe('golden: hero history after the demo commit', () => {
  // Validates: history-audit 7.3
  it('replays two prior commits whose second commit is the merge base', () => {
    const history = scenarioHistory(heroScenario);
    expect(history).toHaveLength(2);
    expect(history[0]?.parentId).toBeNull();
    expect(history[1]?.parentId).toBe(history[0]?.id);
    expect(Object.fromEntries((history[1]?.entries ?? []).map((e) => [e.drugKey, formatEntry(e)]))).toEqual({
      'amlodipine-tab': '5 mg|1/day|active',
      'aspirin-tab': '75 mg|1/day|active',
      'atorvastatin-tab': '20 mg|1/day|active',
      'levothyroxine-tab': '50 mcg|1/day|active',
      'metformin-tab': '500 mg|2/day|active',
      'paracetamol-tab': '500 mg|prn|active',
    });
  });

  // Validates: history-audit 2.6, 3.1, 4.1
  it('verifies, logs three commits and ids recompute independently', () => {
    const { history, commit } = heroAfterCommit();
    expect(verifyChain(history)).toEqual({ ok: true, value: true });
    const lines = log(history);
    expect(lines).toHaveLength(3);
    expect(lines[0]?.id).toBe(commit.id);
    expect(lines[0]?.entryCount).toBe(9);
    expect(lines[0]?.resolutionCount).toBe(6);
    for (const c of history) expect(c.id).toBe(independentId(c));
    expect(commit.at).toBe(heroScenario.demoCommit?.at);
    expect(commit.message).toBe(heroScenario.demoCommit?.message);
  });

  // Validates: history-audit 5.1, 5.2
  it('diff against the head prior commit equals expectedAfterDemoScript.diffVsHead', () => {
    const { history, commit } = heroAfterCommit();
    expect(diffCommits(history[1] ?? null, commit)).toEqual(heroScenario.expectedAfterDemoScript?.diffVsHead);
  });

  // Validates: history-audit 6.5
  it('blame equals expectedAfterDemoScript.blame', () => {
    const { history } = heroAfterCommit();
    const ids = history.map((c) => c.id);
    const expected = heroScenario.expectedAfterDemoScript?.blame ?? {};
    const got = Object.fromEntries(
      blame(history).map((b) => [
        b.drugKey,
        {
          blamedCommit: ids.indexOf(b.blamedCommitId),
          reasonCodes: b.reasonCodes,
          lastDecision: b.lastDecision ? { commit: ids.indexOf(b.lastDecision.commitId), reasonCodes: b.lastDecision.reasonCodes } : null,
        },
      ]),
    );
    expect(got).toEqual(expected);
  });
});
