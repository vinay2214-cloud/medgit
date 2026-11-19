#!/usr/bin/env node
/**
 * Requirement traceability check. Plain Node, no dependencies.
 *
 *   node scripts/check-traceability.mjs            fail on references to requirements that do not exist
 *   node scripts/check-traceability.mjs --strict   also fail if a requirement criterion is not referenced by any task
 *   node scripts/check-traceability.mjs --report   print coverage per spec (tasks and tests)
 *
 * Conventions (see .kiro/steering/structure.md):
 *   requirements.md  "### Requirement N: ..." followed by numbered acceptance criteria "1. THE ..." => ids "N.1", "N.2" ...
 *   tasks.md         "_Requirements: 2.1, 2.2_" refer to ids in the same spec
 *   tests            "// Validates: merge-engine 7.2, 7.3" (spec folder name, then ids; later ids reuse the last name)
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SPECS = '.kiro/specs';
const strict = process.argv.includes('--strict');
const report = process.argv.includes('--report');
const problems = [];

function parseRequirements(file) {
  const ids = new Set();
  let req = null;
  let inCriteria = false;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const h = /^###\s+Requirement\s+(\d+)\b/.exec(line);
    if (h) { req = h[1]; inCriteria = false; continue; }
    if (/^####\s+Acceptance Criteria/.test(line)) { inCriteria = true; continue; }
    if (/^#{1,4}\s/.test(line) && !/^####\s+Acceptance/.test(line)) { if (!/^###\s+Requirement/.test(line)) inCriteria = false; }
    const c = /^(\d+)\.\s+\S/.exec(line);
    if (c && req && inCriteria) ids.add(`${req}.${c[1]}`);
  }
  return ids;
}

function* walk(dir, exts) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) { if (name !== 'node_modules') yield* walk(p, exts); }
    else if (exts.some((e) => name.endsWith(e))) yield p;
  }
}

const reqs = new Map();       // spec -> Set(ids)
const taskRefs = new Map();   // spec -> Set(ids)
const testRefs = new Map();   // spec -> Set(ids)

if (!existsSync(SPECS)) { console.log('check-traceability: no specs directory'); process.exit(0); }
for (const spec of readdirSync(SPECS).sort()) {
  const dir = join(SPECS, spec);
  if (!statSync(dir).isDirectory()) continue;
  const rf = join(dir, 'requirements.md');
  if (!existsSync(rf)) { problems.push(`${dir}: requirements.md is missing`); continue; }
  reqs.set(spec, parseRequirements(rf));
  taskRefs.set(spec, new Set());
  testRefs.set(spec, new Set());
  for (const f of ['design.md', 'tasks.md']) if (!existsSync(join(dir, f))) problems.push(`${dir}: ${f} is missing`);
  const tf = join(dir, 'tasks.md');
  if (existsSync(tf)) {
    readFileSync(tf, 'utf8').split(/\r?\n/).forEach((line, i) => {
      const m = /_Requirements:\s*([^_]+)_/.exec(line);
      if (!m) return;
      for (const id of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
        if (!/^\d+\.\d+$/.test(id)) problems.push(`${tf}:${i + 1}: "${id}" is not a requirement id`);
        else if (!reqs.get(spec).has(id)) problems.push(`${tf}:${i + 1}: requirement ${id} does not exist in ${spec}`);
        else taskRefs.get(spec).add(id);
      }
    });
  }
}

for (const file of [...walk('tests', ['.ts', '.tsx']), ...walk('e2e', ['.ts'])]) {
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    const m = /Validates:\s*(.+)$/.exec(line);
    if (!m) return;
    let current = null;
    for (const tok of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      const withSpec = /^([a-z][a-z0-9-]*)\s+(\d+\.\d+)$/.exec(tok);
      const bare = /^(\d+\.\d+)$/.exec(tok);
      let id;
      if (withSpec) { current = withSpec[1]; id = withSpec[2]; }
      else if (bare && current) id = bare[1];
      else { problems.push(`${file}:${i + 1}: cannot read "${tok}" (use "<spec> x.y")`); continue; }
      if (!reqs.has(current)) problems.push(`${file}:${i + 1}: unknown spec "${current}"`);
      else if (!reqs.get(current).has(id)) problems.push(`${file}:${i + 1}: requirement ${id} does not exist in ${current}`);
      else testRefs.get(current).add(id);
    }
  });
}

const uncovered = [];
for (const [spec, ids] of reqs) {
  const missingTask = [...ids].filter((id) => !taskRefs.get(spec).has(id));
  if (report) {
    const missingTest = [...ids].filter((id) => !testRefs.get(spec).has(id));
    console.log(`${spec}: ${ids.size} criteria, ${ids.size - missingTask.length} referenced by tasks, ${ids.size - missingTest.length} referenced by tests`);
    if (missingTask.length) console.log(`  not in any task: ${missingTask.join(', ')}`);
  }
  if (missingTask.length) uncovered.push(`${spec}: not referenced by any task: ${missingTask.join(', ')}`);
}
if (strict) problems.push(...uncovered);

if (problems.length) {
  console.error('Traceability check failed:\n- ' + problems.join('\n- '));
  process.exit(1);
}
if (!report && uncovered.length) console.log('Note (use --strict to fail on these):\n- ' + uncovered.join('\n- '));
console.log('Traceability check passed.');
