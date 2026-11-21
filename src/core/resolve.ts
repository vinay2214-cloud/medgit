/**
 * Resolution validation and draft computation (docs/MERGE_SEMANTICS.md sections 4 and 5).
 * Validates merge-engine 6.x, 7.x, 8.x, 9.1 to 9.3.
 */

import { err, ok, type ResolveError, type ResolveErrorCode, type Result } from './errors';
import { cloneEntry, fieldOfKind, templateEntry, type FieldKind } from './merge';
import { compareCodeUnits } from './text';
import type {
  Conflict,
  ConflictId,
  ConflictState,
  Decision,
  Draft,
  EffectiveResolution,
  Frequency,
  MedEntry,
  MergeResult,
  ReasonCode,
  Resolution,
  Status,
  Strength,
} from './types';

export const REASON_CODES: readonly ReasonCode[] = [
  'VERIFIED_WITH_PRESCRIBER',
  'CONFIRMED_WITH_PATIENT',
  'PER_DISPENSING_RECORD',
  'PER_DISCHARGE_SUMMARY',
  'CLINICAL_JUDGEMENT',
  'NEEDS_PHARMACIST_REVIEW',
];

export const NOTE_MAX = 280;

const STATUSES: readonly string[] = ['active', 'stopped', 'on-hold'];
const UNITS: readonly string[] = ['mg', 'mcg', 'ml', 'iu'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isValidStrength(v: unknown): v is Strength {
  if (!isRecord(v) || typeof v.unit !== 'string' || !UNITS.includes(v.unit)) return false;
  const values = v.values;
  return (
    Array.isArray(values) &&
    (values.length === 1 || values.length === 2) &&
    values.every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0)
  );
}

export function isValidFrequency(v: unknown): v is Frequency {
  if (!isRecord(v)) return false;
  if (v.kind === 'prn') return true;
  return v.kind === 'scheduled' && (v.perDay === 1 || v.perDay === 2 || v.perDay === 3 || v.perDay === 4);
}

export function isValidStatus(v: unknown): v is Status {
  return typeof v === 'string' && STATUSES.includes(v);
}

export function isValidCustomValue(kind: FieldKind, value: unknown): boolean {
  if (kind === 'DOSE') return isValidStrength(value);
  if (kind === 'FREQUENCY') return isValidFrequency(value);
  return isValidStatus(value);
}

function isClaimant(conflict: Conflict, source: string): boolean {
  return conflict.claims.some((c) => c.source === source && c.entry !== null);
}

/** Decision type allowed for the kind, and choose/custom payload valid. Authorisation is separate. */
function decisionProblem(conflict: Conflict, decision: Decision): { code: ResolveErrorCode; message: string } | null {
  const t = (decision as { type?: unknown }).type;
  if (conflict.kind === 'OMISSION') {
    if (t === 'include' || t === 'exclude' || t === 'escalate') return null;
    return { code: 'INVALID_DECISION', message: `${String(t)} is not allowed on a missing-medicine conflict` };
  }
  if (t === 'escalate') return null;
  if (t === 'choose') {
    const source = (decision as { source?: unknown }).source;
    if (typeof source !== 'string' || !isClaimant(conflict, source)) {
      return { code: 'NOT_A_CLAIMANT', message: `${String(source)} has no claim on ${conflict.id}` };
    }
    return null;
  }
  if (t === 'custom') {
    if (!isValidCustomValue(conflict.kind, (decision as { value?: unknown }).value)) {
      return { code: 'INVALID_DECISION', message: `the value does not fit a ${conflict.kind} conflict` };
    }
    return null;
  }
  return { code: 'INVALID_DECISION', message: `${String(t)} is not allowed on a ${conflict.kind} conflict` };
}

/** Latest event (highest seq) per conflict id. */
export function effectiveResolutions(resolutions: Resolution[]): Map<ConflictId, Resolution> {
  const out = new Map<ConflictId, Resolution>();
  for (const r of resolutions) {
    const cur = out.get(r.conflictId);
    if (cur === undefined || r.seq >= cur.seq) out.set(r.conflictId, r);
  }
  return out;
}

function fail(code: ResolveErrorCode, message: string): { ok: false; error: ResolveError } {
  return err({ code, message });
}

export function validateResolution(
  merge: MergeResult,
  existing: Resolution[],
  candidate: Omit<Resolution, 'seq'>,
): Result<Resolution, ResolveError> {
  const conflict = merge.conflicts.find((c) => c.id === candidate.conflictId);
  if (!conflict) return fail('INVALID_DECISION', `no conflict ${String(candidate.conflictId)}`);
  if (!REASON_CODES.includes(candidate.reasonCode)) return fail('REASON_REQUIRED', 'a reason code is required');

  const type = (candidate.decision as { type?: unknown } | null)?.type;
  if (conflict.kind === 'OMISSION' ? !['include', 'exclude', 'escalate'].includes(String(type)) : !['choose', 'custom', 'escalate'].includes(String(type))) {
    return fail('INVALID_DECISION', `${String(type)} is not allowed on a ${conflict.kind} conflict`);
  }
  const isEscalate = type === 'escalate';
  const isReview = candidate.reasonCode === 'NEEDS_PHARMACIST_REVIEW';
  if (isEscalate !== isReview) {
    return fail('INVALID_DECISION', isEscalate ? 'escalation needs the reason NEEDS_PHARMACIST_REVIEW' : 'NEEDS_PHARMACIST_REVIEW is only for escalation');
  }
  const problem = decisionProblem(conflict, candidate.decision);
  if (problem) return fail(problem.code, problem.message);
  if (candidate.note !== undefined && (typeof candidate.note !== 'string' || candidate.note.length > NOTE_MAX)) {
    return fail('INVALID_DECISION', `the note is longer than ${NOTE_MAX} characters`);
  }
  const role = candidate.by?.role;
  if (role !== 'clinician' && role !== 'pharmacist') return fail('NOT_AUTHORISED', 'unknown role');
  const effective = effectiveResolutions(existing).get(conflict.id);
  if (effective?.decision.type === 'escalate' && !isEscalate && role !== 'pharmacist') {
    return fail('NOT_AUTHORISED', 'only a pharmacist can decide an escalated conflict');
  }

  const seq = existing.reduce((m, r) => Math.max(m, r.seq), 0) + 1;
  const resolution: Resolution = {
    seq,
    conflictId: conflict.id,
    decision: cloneDecision(candidate.decision),
    reasonCode: candidate.reasonCode,
    by: candidate.by.name === undefined ? { role } : { role, name: candidate.by.name },
    at: candidate.at,
  };
  if (candidate.note !== undefined) resolution.note = candidate.note;
  return ok(resolution);
}

export function cloneDecision(d: Decision): Decision {
  if (d.type === 'choose') return { type: 'choose', source: d.source };
  if (d.type === 'custom') {
    const v = d.value;
    return { type: 'custom', value: typeof v === 'string' ? v : 'values' in v ? { values: [...v.values], unit: v.unit } : { ...v } };
  }
  return { type: d.type };
}

/** Value a decided field conflict gives the field. */
function decidedValue(conflict: Conflict, decision: Decision): MedEntry[keyof MedEntry] | undefined {
  if (conflict.kind === 'OMISSION') return undefined;
  const field = fieldOfKind(conflict.kind);
  if (decision.type === 'choose') {
    const entry = conflict.claims.find((c) => c.source === decision.source)?.entry;
    return entry ? cloneEntry(entry)[field] : undefined;
  }
  if (decision.type === 'custom') {
    const copy = cloneDecision(decision);
    return copy.type === 'custom' ? copy.value : undefined;
  }
  return undefined;
}

/**
 * Compute the working draft. Total: ignores resolutions for unknown conflicts and events whose
 * decision is not valid for the conflict (the effective resolution is the latest valid event).
 */
export function applyResolutions(merge: MergeResult, resolutions: Resolution[]): Draft {
  const byId = new Map(merge.conflicts.map((c) => [c.id, c]));
  const valid = resolutions.filter((r) => {
    const c = byId.get(r.conflictId);
    return c !== undefined && r.decision !== null && typeof r.decision === 'object' && decisionProblem(c, r.decision) === null;
  });
  const eff = effectiveResolutions(valid);

  const excludedSet = new Set<string>();
  for (const c of merge.conflicts) {
    if (c.kind === 'OMISSION' && eff.get(c.id)?.decision.type === 'exclude') excludedSet.add(c.drugKey);
  }

  const states = {} as Record<ConflictId, ConflictState>;
  for (const c of merge.conflicts) {
    if (c.kind !== 'OMISSION' && excludedSet.has(c.drugKey)) states[c.id] = 'superseded';
    else {
      const d = eff.get(c.id);
      states[c.id] = d === undefined ? 'open' : d.decision.type === 'escalate' ? 'escalated' : 'resolved';
    }
  }

  const byDrug = new Map<string, Conflict[]>();
  for (const c of merge.conflicts) {
    const list = byDrug.get(c.drugKey) ?? [];
    list.push(c);
    byDrug.set(c.drugKey, list);
  }

  const entries: MedEntry[] = merge.clean.map((c) => cloneEntry(c.entry));
  const pendingDrugKeys: string[] = [];
  for (const [drugKey, conflicts] of byDrug) {
    if (excludedSet.has(drugKey)) continue;
    if (conflicts.some((c) => states[c.id] === 'open' || states[c.id] === 'escalated')) {
      pendingDrugKeys.push(drugKey);
      continue;
    }
    // listing sources: claims with a non-null entry, already in source id order
    const first = conflicts[0];
    if (!first) continue;
    const listed = first.claims.flatMap((c) => (c.entry ? [c.entry] : []));
    if (listed.length === 0) continue;
    const entry = templateEntry(listed);
    for (const c of conflicts) {
      if (c.kind === 'OMISSION') continue;
      const d = eff.get(c.id);
      const value = d ? decidedValue(c, d.decision) : undefined;
      if (value === undefined) continue;
      const field = fieldOfKind(c.kind);
      if (field === 'strength') entry.strength = value as Strength | null;
      else if (field === 'frequency') entry.frequency = value as Frequency | null;
      else entry.status = value as Status;
    }
    entries.push(entry);
  }

  entries.sort((a, b) => compareCodeUnits(a.drugKey, b.drugKey));
  pendingDrugKeys.sort(compareCodeUnits);
  const pendingCount = merge.conflicts.filter((c) => states[c.id] === 'open' || states[c.id] === 'escalated').length;
  const effective: EffectiveResolution[] = [...eff.values()]
    .sort((a, b) => compareCodeUnits(a.conflictId, b.conflictId))
    .map((r) => {
      const copy: EffectiveResolution = {
        seq: r.seq,
        conflictId: r.conflictId,
        decision: cloneDecision(r.decision),
        reasonCode: r.reasonCode,
        by: r.by.name === undefined ? { role: r.by.role } : { role: r.by.role, name: r.by.name },
        at: r.at,
        manual: r.decision.type === 'custom',
      };
      if (r.note !== undefined) copy.note = r.note;
      return copy;
    });

  return {
    states,
    entries,
    excluded: [...excludedSet].sort(compareCodeUnits),
    pendingDrugKeys,
    pendingCount,
    canCommit: pendingCount === 0,
    effective,
  };
}
