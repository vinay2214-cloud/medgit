#!/usr/bin/env node
/**
 * Validate data/formulary.json, data/scenarios/*.json and data/vectors/canonical.json.
 * Plain Node, no dependencies. Exit 1 with file and reason on any failure.
 * Rules: .kiro/specs/project-bootstrap/requirements.md, requirement 5.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const KINDS = new Set(['OMISSION', 'DOSE', 'FREQUENCY', 'STATUS']);
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const problems = [];
const fail = (file, msg) => problems.push(`${file}: ${msg}`);

function load(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { fail(file, `cannot read or parse (${e.message})`); return null; }
}

// ---- formulary (5.1, 5.2)
const FORMULARY = 'data/formulary.json';
const ids = new Set();
if (!existsSync(FORMULARY)) fail(FORMULARY, 'not found');
else {
  const f = load(FORMULARY);
  if (f) {
    if (f.schema !== 'medgit.formulary/1') fail(FORMULARY, `schema must be medgit.formulary/1 (found ${f.schema})`);
    if (!Array.isArray(f.items) || f.items.length === 0) fail(FORMULARY, 'items must be a non-empty array');
    else {
      const aliasOwner = new Map();
      for (const it of f.items) {
        for (const k of ['id', 'ingredient', 'display', 'form', 'route', 'canonicalUnit', 'strengths', 'aliases']) {
          if (it[k] === undefined || it[k] === null) fail(FORMULARY, `item ${it.id ?? '?'} is missing ${k}`);
        }
        if (ids.has(it.id)) fail(FORMULARY, `duplicate id ${it.id}`);
        ids.add(it.id);
        if (!['mg', 'mcg', 'ml', 'iu'].includes(it.canonicalUnit)) fail(FORMULARY, `item ${it.id} has an invalid canonicalUnit`);
        if (!Array.isArray(it.strengths) || !it.strengths.every((s) => Array.isArray(s) && s.length >= 1 && s.length <= 2 && s.every((n) => typeof n === 'number' && n > 0))) fail(FORMULARY, `item ${it.id} has invalid strengths`);
        for (const a of it.aliases ?? []) {
          const key = norm(a);
          if (!key) { fail(FORMULARY, `item ${it.id} has an empty alias`); continue; }
          if (aliasOwner.has(key) && aliasOwner.get(key) !== it.id) fail(FORMULARY, `alias "${a}" is used by both ${aliasOwner.get(key)} and ${it.id}`);
          aliasOwner.set(key, it.id);
        }
      }
    }
  }
}

// ---- scenarios (5.3, 5.4, 5.5)
const SDIR = 'data/scenarios';
if (!existsSync(SDIR)) fail(SDIR, 'not found');
else {
  const files = readdirSync(SDIR).filter((n) => n.endsWith('.json')).sort();
  if (files.length === 0) fail(SDIR, 'no scenario files');
  for (const n of files) {
    const file = join(SDIR, n).replace(/\\/g, '/');
    const sc = load(file);
    if (!sc) continue;
    if (sc.schema !== 'medgit.scenario/1') fail(file, `schema must be medgit.scenario/1 (found ${sc.schema})`);
    if (typeof sc.syntheticNotice !== 'string' || !sc.syntheticNotice.trim()) fail(file, 'syntheticNotice is required');
    if (!Array.isArray(sc.sources) || sc.sources.length < 2) fail(file, 'at least two sources are required');
    else {
      const seen = new Set();
      for (const s of sc.sources) {
        if (seen.has(s.id)) fail(file, `duplicate source id ${s.id}`);
        seen.add(s.id);
        if (!Array.isArray(s.items)) fail(file, `source ${s.id} has no items array`);
      }
    }
    if (!sc.expected || typeof sc.expected !== 'object') { fail(file, 'expected block is required'); continue; }
    const conflictIds = new Set();
    for (const c of sc.expected.conflicts ?? []) {
      const m = /^(.+)::([A-Z]+)$/.exec(c.id ?? '');
      if (!m || !KINDS.has(m[2])) { fail(file, `conflict id "${c.id}" must be <drugKey>::<KIND>`); continue; }
      if (c.kind !== m[2]) fail(file, `conflict ${c.id} has kind ${c.kind}`);
      if (!ids.has(m[1]) && !m[1].startsWith('unmapped:')) fail(file, `conflict ${c.id} names a drugKey that is not in the formulary and not unmapped:`);
      conflictIds.add(c.id);
    }
    for (const c of sc.expected.clean ?? []) {
      if (!ids.has(c.drugKey) && !String(c.drugKey).startsWith('unmapped:')) fail(file, `clean entry ${c.drugKey} is not in the formulary and not unmapped:`);
    }
    for (const step of sc.demoScript ?? []) {
      if (!conflictIds.has(step.conflictId)) fail(file, `demoScript names conflict ${step.conflictId}, which is not in expected.conflicts`);
    }
    if (sc.id === 'hero') {
      if (!sc.expectedAfterDemoScript || !sc.demoCommit) fail(file, 'hero must have demoCommit and expectedAfterDemoScript');
    }
  }
}

// ---- vectors (5.6)
const VEC = 'data/vectors/canonical.json';
if (!existsSync(VEC)) fail(VEC, 'not found');
else {
  const v = load(VEC);
  if (v) {
    if (!Array.isArray(v.canonical) || v.canonical.length === 0) fail(VEC, 'canonical vectors are required');
    for (const x of v.canonical ?? []) if (typeof x.canonical !== 'string' || !/^[0-9a-f]{64}$/.test(x.sha256 ?? '')) fail(VEC, `vector "${x.name}" needs canonical and a 64-character sha256`);
    for (const x of v.sha256 ?? []) if (!/^[0-9a-f]{64}$/.test(x.sha256 ?? '')) fail(VEC, `sha256 vector "${x.name}" is invalid`);
  }
}

if (problems.length) {
  console.error('Data validation failed:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('Data validation passed.');
