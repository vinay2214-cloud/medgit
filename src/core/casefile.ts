/**
 * JSON case file (medgit.case/1): save and reload a case.
 * Import validates every field it returns, drops unknown fields and never throws.
 * A broken commit chain is not a reason to reject a file; the caller shows verifyChain.
 * Validates interop-export 1.x, 2.x.
 */

import type { Clock } from './clock';
import { err, ok, type CaseFileError, type Result } from './errors';
import type {
  Actor,
  Commit,
  Decision,
  EffectiveResolution,
  EntryFlag,
  Frequency,
  MedEntry,
  RawItem,
  RawSourceList,
  ReasonCode,
  Resolution,
  SourceKind,
  Status,
  Strength,
  Unit,
} from './types';

export interface CasePatient {
  label: string;
  age: number;
  sex: string;
}

export interface CaseState {
  scenarioId: string | null;
  patient: CasePatient;
  syntheticNotice: string;
  rawSources: RawSourceList[];
  /** Root to head. */
  history: Commit[];
  /** Uncommitted working events. */
  resolutions: Resolution[];
}

export const CASEFILE_SCHEMA = 'medgit.case/1';
export const DEFAULT_SYNTHETIC_NOTICE = 'SYNTHETIC DATA. Invented for a software demonstration. Not for clinical use.';

export const CASEFILE_LIMITS = {
  textLength: 2_000_000,
  sources: 8,
  itemsPerSource: 200,
  commits: 100,
  resolutions: 500,
  stringLength: 2000,
} as const;

// ------------------------------------------------------------------ export

function actorOut(a: Actor): Actor {
  return a.name === undefined ? { role: a.role } : { role: a.role, name: a.name };
}

function strengthOut(s: Strength | null): Strength | null {
  return s === null ? null : { values: [...s.values], unit: s.unit };
}

function frequencyOut(f: Frequency | null): Frequency | null {
  return f === null ? null : f.kind === 'prn' ? { kind: 'prn' } : { kind: 'scheduled', perDay: f.perDay };
}

function entryOut(e: MedEntry): MedEntry {
  return { drugKey: e.drugKey, displayName: e.displayName, strength: strengthOut(e.strength), frequency: frequencyOut(e.frequency), status: e.status, flags: [...e.flags] };
}

function decisionOut(d: Decision): Decision {
  switch (d.type) {
    case 'choose':
      return { type: 'choose', source: d.source };
    case 'custom': {
      const v = d.value;
      return { type: 'custom', value: typeof v === 'string' ? v : 'values' in v ? strengthOut(v) as Strength : frequencyOut(v) as Frequency };
    }
    default:
      return { type: d.type };
  }
}

function resolutionOut(r: Resolution): Resolution {
  const out: Resolution = { seq: r.seq, conflictId: r.conflictId, decision: decisionOut(r.decision), reasonCode: r.reasonCode, by: actorOut(r.by), at: r.at };
  if (r.note !== undefined) out.note = r.note;
  return out;
}

function effectiveOut(r: EffectiveResolution): EffectiveResolution {
  return { ...resolutionOut(r), manual: r.manual };
}

function rawItemOut(i: RawItem): RawItem {
  const out: RawItem = { name: i.name };
  if (i.form !== undefined) out.form = i.form;
  if (i.strength !== undefined) out.strength = i.strength;
  if (i.frequency !== undefined) out.frequency = i.frequency;
  if (i.status !== undefined) out.status = i.status;
  if (i.note !== undefined) out.note = i.note;
  return out;
}

function commitOut(c: Commit): Commit {
  return {
    id: c.id,
    parentId: c.parentId,
    message: c.message,
    author: actorOut(c.author),
    at: c.at,
    entries: c.entries.map(entryOut),
    resolutions: c.resolutions.map(effectiveOut),
    agreements: c.agreements.map((a) => ({ drugKey: a.drugKey, agreedBy: [...a.agreedBy] })),
    sourcesSeen: c.sourcesSeen.map((s) => ({ id: s.id, asOf: s.asOf })),
  };
}

/** Pretty-printed (two spaces), fixed key order, deterministic for the same state and clock. */
export function exportCaseFile(state: CaseState, clock: Clock): string {
  const file = {
    schema: CASEFILE_SCHEMA,
    syntheticNotice: state.syntheticNotice.trim() === '' ? DEFAULT_SYNTHETIC_NOTICE : state.syntheticNotice,
    exportedAt: clock.now(),
    scenarioId: state.scenarioId,
    patient: { label: state.patient.label, age: state.patient.age, sex: state.patient.sex },
    sources: state.rawSources.map((s) => ({ id: s.id, label: s.label, kind: s.kind, asOf: s.asOf, items: s.items.map(rawItemOut) })),
    history: state.history.map(commitOut),
    resolutions: state.resolutions.map(resolutionOut),
  };
  return JSON.stringify(file, null, 2);
}

// ------------------------------------------------------------------ import

class Invalid {
  constructor(readonly message: string) {}
}

function fail(path: string, what = 'is not valid'): never {
  throw new Invalid(`${path} ${what}`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function rec(v: unknown, path: string): Record<string, unknown> {
  if (!isRecord(v)) fail(path, 'is not an object');
  return v;
}

function text(v: unknown, path: string): string {
  if (typeof v !== 'string') fail(path, v === undefined ? 'is missing' : 'is not a string');
  if (v.length > CASEFILE_LIMITS.stringLength) fail(path, 'is too long');
  return v;
}

function optText(v: unknown, path: string): string | undefined {
  return v === undefined ? undefined : text(v, path);
}

function num(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, 'is not a number');
  return v;
}

function list(v: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(v)) fail(path, v === undefined ? 'is missing' : 'is not a list');
  if (v.length > max) fail(path, `has more than ${max} items`);
  return v;
}

function oneOf<T extends string>(v: unknown, options: readonly T[], path: string): T {
  if (typeof v !== 'string' || !(options as readonly string[]).includes(v)) fail(path);
  return v as T;
}

const ROLES = ['clinician', 'pharmacist'] as const;
const KINDS: readonly SourceKind[] = ['prescriber', 'dispenser', 'patient'];
const STATUSES: readonly Status[] = ['active', 'stopped', 'on-hold'];
const UNITS: readonly Unit[] = ['mg', 'mcg', 'ml', 'iu'];
const FLAGS: readonly EntryFlag[] = ['UNMAPPED_DRUG', 'UNPARSED_STRENGTH', 'STRENGTH_NOT_IN_FORMULARY', 'UNPARSED_FREQUENCY', 'UNPARSED_STATUS'];
const REASONS: readonly ReasonCode[] = ['VERIFIED_WITH_PRESCRIBER', 'CONFIRMED_WITH_PATIENT', 'PER_DISPENSING_RECORD', 'PER_DISCHARGE_SUMMARY', 'CLINICAL_JUDGEMENT', 'NEEDS_PHARMACIST_REVIEW'];
const CONFLICT_ID = /^.+::(OMISSION|DOSE|FREQUENCY|STATUS)$/;

function actor(v: unknown, path: string): Actor {
  const r = rec(v, path);
  const out: Actor = { role: oneOf(r.role, ROLES, `${path}.role`) };
  const name = optText(r.name, `${path}.name`);
  if (name !== undefined) out.name = name;
  return out;
}

function strength(v: unknown, path: string): Strength {
  const r = rec(v, path);
  const values = list(r.values, `${path}.values`, 2).map((n, i) => {
    const x = num(n, `${path}.values[${i}]`);
    if (x <= 0) fail(`${path}.values[${i}]`);
    return x;
  });
  if (values.length === 0) fail(`${path}.values`);
  return { values, unit: oneOf(r.unit, UNITS, `${path}.unit`) };
}

function frequency(v: unknown, path: string): Frequency {
  const r = rec(v, path);
  if (r.kind === 'prn') return { kind: 'prn' };
  if (r.kind === 'scheduled' && (r.perDay === 1 || r.perDay === 2 || r.perDay === 3 || r.perDay === 4)) return { kind: 'scheduled', perDay: r.perDay };
  return fail(path);
}

function medEntry(v: unknown, path: string): MedEntry {
  const r = rec(v, path);
  return {
    drugKey: text(r.drugKey, `${path}.drugKey`),
    displayName: text(r.displayName, `${path}.displayName`),
    strength: r.strength === null ? null : strength(r.strength, `${path}.strength`),
    frequency: r.frequency === null ? null : frequency(r.frequency, `${path}.frequency`),
    status: oneOf(r.status, STATUSES, `${path}.status`),
    flags: list(r.flags, `${path}.flags`, FLAGS.length).map((f, i) => oneOf(f, FLAGS, `${path}.flags[${i}]`)),
  };
}

function decision(v: unknown, path: string): Decision {
  const r = rec(v, path);
  switch (r.type) {
    case 'include':
    case 'exclude':
    case 'escalate':
      return { type: r.type };
    case 'choose':
      return { type: 'choose', source: text(r.source, `${path}.source`) };
    case 'custom': {
      const value = r.value;
      if (typeof value === 'string') return { type: 'custom', value: oneOf(value, STATUSES, `${path}.value`) };
      const vr = rec(value, `${path}.value`);
      return { type: 'custom', value: 'values' in vr ? strength(vr, `${path}.value`) : frequency(vr, `${path}.value`) };
    }
    default:
      return fail(`${path}.type`);
  }
}

function resolution(v: unknown, path: string): Resolution {
  const r = rec(v, path);
  const seq = num(r.seq, `${path}.seq`);
  if (!Number.isInteger(seq) || seq < 1) fail(`${path}.seq`);
  const conflictId = text(r.conflictId, `${path}.conflictId`);
  if (!CONFLICT_ID.test(conflictId)) fail(`${path}.conflictId`);
  const out: Resolution = {
    seq,
    conflictId: conflictId as Resolution['conflictId'],
    decision: decision(r.decision, `${path}.decision`),
    reasonCode: oneOf(r.reasonCode, REASONS, `${path}.reasonCode`),
    by: actor(r.by, `${path}.by`),
    at: text(r.at, `${path}.at`),
  };
  const note = optText(r.note, `${path}.note`);
  if (note !== undefined) out.note = note;
  return out;
}

function effective(v: unknown, path: string): EffectiveResolution {
  const r = rec(v, path);
  if (typeof r.manual !== 'boolean') fail(`${path}.manual`);
  return { ...resolution(v, path), manual: r.manual };
}

function rawItem(v: unknown, path: string): RawItem {
  const r = rec(v, path);
  const out: RawItem = { name: text(r.name, `${path}.name`) };
  for (const k of ['form', 'strength', 'frequency', 'status', 'note'] as const) {
    const x = optText(r[k], `${path}.${k}`);
    if (x !== undefined) out[k] = x;
  }
  return out;
}

function rawSource(v: unknown, path: string): RawSourceList {
  const r = rec(v, path);
  return {
    id: text(r.id, `${path}.id`),
    label: text(r.label, `${path}.label`),
    kind: oneOf(r.kind, KINDS, `${path}.kind`),
    asOf: text(r.asOf, `${path}.asOf`),
    items: list(r.items, `${path}.items`, CASEFILE_LIMITS.itemsPerSource).map((x, i) => rawItem(x, `${path}.items[${i}]`)),
  };
}

function commit(v: unknown, path: string): Commit {
  const r = rec(v, path);
  return {
    id: text(r.id, `${path}.id`),
    parentId: r.parentId === null ? null : text(r.parentId, `${path}.parentId`),
    message: text(r.message, `${path}.message`),
    author: actor(r.author, `${path}.author`),
    at: text(r.at, `${path}.at`),
    entries: list(r.entries, `${path}.entries`, 1000).map((x, i) => medEntry(x, `${path}.entries[${i}]`)),
    resolutions: list(r.resolutions, `${path}.resolutions`, CASEFILE_LIMITS.resolutions).map((x, i) => effective(x, `${path}.resolutions[${i}]`)),
    agreements: list(r.agreements, `${path}.agreements`, 1000).map((x, i) => {
      const a = rec(x, `${path}.agreements[${i}]`);
      return {
        drugKey: text(a.drugKey, `${path}.agreements[${i}].drugKey`),
        agreedBy: list(a.agreedBy, `${path}.agreements[${i}].agreedBy`, CASEFILE_LIMITS.sources).map((s, j) => text(s, `${path}.agreements[${i}].agreedBy[${j}]`)),
      };
    }),
    sourcesSeen: list(r.sourcesSeen, `${path}.sourcesSeen`, CASEFILE_LIMITS.sources).map((x, i) => {
      const s = rec(x, `${path}.sourcesSeen[${i}]`);
      return { id: text(s.id, `${path}.sourcesSeen[${i}].id`), asOf: text(s.asOf, `${path}.sourcesSeen[${i}].asOf`) };
    }),
  };
}

export function importCaseFile(input: string): Result<CaseState, CaseFileError> {
  try {
    if (typeof input !== 'string') return err({ code: 'CASEFILE_INVALID', message: 'the file is not text' });
    if (input.length > CASEFILE_LIMITS.textLength) return err({ code: 'CASEFILE_INVALID', message: 'the file is larger than 2,000,000 characters' });
    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch {
      return err({ code: 'CASEFILE_INVALID', message: 'the file is not valid JSON' });
    }
    const r = rec(parsed, 'file');
    if (r.schema !== CASEFILE_SCHEMA) fail('schema', `must be ${CASEFILE_SCHEMA}`);
    const syntheticNotice = text(r.syntheticNotice, 'syntheticNotice');
    if (syntheticNotice.trim() === '') fail('syntheticNotice', 'is empty');
    const scenarioId = r.scenarioId === null ? null : text(r.scenarioId, 'scenarioId');
    const p = rec(r.patient, 'patient');
    const patient: CasePatient = { label: text(p.label, 'patient.label'), age: num(p.age, 'patient.age'), sex: text(p.sex, 'patient.sex') };
    const rawSources = list(r.sources, 'sources', CASEFILE_LIMITS.sources).map((x, i) => rawSource(x, `sources[${i}]`));
    const history = list(r.history, 'history', CASEFILE_LIMITS.commits).map((x, i) => commit(x, `history[${i}]`));
    const resolutions = list(r.resolutions, 'resolutions', CASEFILE_LIMITS.resolutions).map((x, i) => resolution(x, `resolutions[${i}]`));
    return ok({ scenarioId, patient, syntheticNotice, rawSources, history, resolutions });
  } catch (e) {
    if (e instanceof Invalid) return err({ code: 'CASEFILE_INVALID', message: e.message });
    return err({ code: 'CASEFILE_INVALID', message: 'the file could not be read' });
  }
}
