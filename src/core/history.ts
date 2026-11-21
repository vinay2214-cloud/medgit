/**
 * Commits, chain verification, log, diff, blame and replay (docs/MERGE_SEMANTICS.md sections 6, 7).
 * The hash chain makes changes to the record detectable; it is not a signature and does not stop
 * anyone from rewriting the whole chain.
 * Validates history-audit 1.x, 2.6, 3.x, 4.x, 5.x, 6.x, 7.x, 8.x.
 */

import { canonicalise, deepClone, sha256Hex } from './canonical';
import type { Clock } from './clock';
import { err, ok, type ChainError, type CommitError, type Result } from './errors';
import { equalValues, FIELD_KINDS, formatField } from './merge';
import { normaliseSourceList } from './normalise/index';
import { compareCodeUnits } from './text';
import type {
  Actor,
  BlameLine,
  Commit,
  CommitDiff,
  Draft,
  Formulary,
  LogLine,
  MedEntry,
  MergeResult,
  PriorCommit,
  ReasonCode,
} from './types';

export const MESSAGE_MAX = 200;

export type CommitBody = Omit<Commit, 'id'>;

function bodyOf(c: Commit): CommitBody {
  const { id: _id, ...body } = c;
  void _id;
  return body;
}

function computeId(body: CommitBody): string | null {
  const text = canonicalise(body);
  return text.ok ? sha256Hex(text.value) : null;
}

/** sha256Hex of the canonical JSON of the commit without its id. */
export function commitId(body: CommitBody): string {
  const id = computeId(body);
  if (id === null) throw new Error('commit body is not canonicalisable');
  return id;
}

function cleanActor(a: Actor): Actor {
  return a.name === undefined ? { role: a.role } : { role: a.role, name: a.name };
}

export function commitDraft(input: {
  merge: MergeResult;
  draft: Draft;
  parent: Commit | null;
  message: string;
  author: Actor;
  clock: Clock;
}): Result<Commit, CommitError> {
  const { merge, draft, parent, author, clock } = input;
  if (!draft.canCommit) return err({ code: 'UNRESOLVED_CONFLICTS' });
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (message.length === 0 || message.length > MESSAGE_MAX) return err({ code: 'MESSAGE_REQUIRED' });

  const body: CommitBody = deepClone({
    parentId: parent?.id ?? null,
    message,
    author: cleanActor(author),
    at: clock.now(),
    entries: draft.entries,
    resolutions: draft.effective,
    agreements: merge.clean.map((c) => ({ drugKey: c.entry.drugKey, agreedBy: [...c.agreedBy] })),
    sourcesSeen: [...merge.sources].sort((a, b) => compareCodeUnits(a.id, b.id)).map((s) => ({ id: s.id, asOf: s.asOf })),
  });
  const id = computeId(body);
  if (id === null) return err({ code: 'CANONICAL_INVALID' });
  return ok({ id, ...body });
}

export function verifyChain(history: Commit[]): Result<true, ChainError> {
  for (let i = 0; i < history.length; i++) {
    const c = history[i];
    if (!c) return err({ code: 'CHAIN_BROKEN', index: i });
    const expectedParent = i === 0 ? null : (history[i - 1]?.id ?? null);
    if (c.parentId !== expectedParent || computeId(bodyOf(c)) !== c.id) return err({ code: 'CHAIN_BROKEN', index: i });
  }
  return ok(true);
}

export function log(history: Commit[]): LogLine[] {
  return [...history].reverse().map((c) => ({
    id: c.id,
    message: c.message,
    author: cleanActor(c.author),
    at: c.at,
    entryCount: c.entries.length,
    resolutionCount: c.resolutions.length,
  }));
}

export function diffCommits(parent: Commit | null, commit: Commit): CommitDiff {
  const before = new Map((parent?.entries ?? []).map((e) => [e.drugKey, e]));
  const after = new Map(commit.entries.map((e) => [e.drugKey, e]));
  const added = [...after.keys()].filter((k) => !before.has(k)).sort(compareCodeUnits);
  const removed = [...before.keys()].filter((k) => !after.has(k)).sort(compareCodeUnits);
  const changed: CommitDiff['changed'] = [];
  for (const k of [...after.keys()].sort(compareCodeUnits)) {
    const a = after.get(k);
    const b = before.get(k);
    if (!a || !b) continue;
    for (const { field } of FIELD_KINDS) {
      const from = formatField(field, b);
      const to = formatField(field, a);
      if (from !== to) changed.push({ drugKey: k, field, from, to });
    }
  }
  return { added, removed, changed };
}

function drugOfConflictId(conflictId: string): string {
  const i = conflictId.lastIndexOf('::');
  return i < 0 ? conflictId : conflictId.slice(0, i);
}

/** Sorted unique reason codes of a commit's non-escalation resolutions for a drug, or null if it has none at all. */
function decisionCodes(c: Commit, drugKey: string): ReasonCode[] | null {
  const forDrug = c.resolutions.filter((r) => drugOfConflictId(r.conflictId) === drugKey);
  if (forDrug.length === 0) return null;
  return [...new Set(forDrug.filter((r) => r.decision.type !== 'escalate').map((r) => r.reasonCode))].sort(compareCodeUnits);
}

function entryOf(c: Commit, drugKey: string): MedEntry | undefined {
  return c.entries.find((e) => e.drugKey === drugKey);
}

export function blame(history: Commit[]): BlameLine[] {
  const headIndex = history.length - 1;
  const head = history[headIndex];
  if (!head) return [];
  return [...head.entries]
    .sort((a, b) => compareCodeUnits(a.drugKey, b.drugKey))
    .map((entry) => {
      let i = headIndex;
      while (i > 0) {
        const prev = history[i - 1];
        const prevEntry = prev ? entryOf(prev, entry.drugKey) : undefined;
        if (!prevEntry || !equalValues(prevEntry, entry)) break;
        i--;
      }
      const blamed = history[i] ?? head;
      let lastDecision: BlameLine['lastDecision'] = null;
      for (let j = headIndex; j >= 0; j--) {
        const c = history[j];
        const codes = c ? decisionCodes(c, entry.drugKey) : null;
        if (c && codes !== null) {
          lastDecision = { commitId: c.id, reasonCodes: codes };
          break;
        }
      }
      return {
        drugKey: entry.drugKey,
        blamedCommitId: blamed.id,
        reasonCodes: decisionCodes(blamed, entry.drugKey) ?? [],
        lastDecision,
      };
    });
}

export function replayPriorCommits(prior: PriorCommit[], formulary: Formulary): Commit[] {
  const out: Commit[] = [];
  for (const p of prior) {
    const { list } = normaliseSourceList({ id: 'prior', label: 'prior', kind: 'prescriber', asOf: p.at, items: p.items }, formulary);
    const body: CommitBody = deepClone({
      parentId: out[out.length - 1]?.id ?? null,
      message: p.message,
      author: cleanActor(p.author),
      at: p.at,
      entries: list.entries,
      resolutions: [],
      agreements: list.entries.map((e) => ({ drugKey: e.drugKey, agreedBy: [] })),
      sourcesSeen: [],
    });
    out.push({ id: commitId(body), ...body });
  }
  return out;
}
