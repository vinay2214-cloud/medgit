#!/usr/bin/env node
/**
 * Hackathon submission compliance checks. Plain Node, no dependencies.
 *
 *   node scripts/check-compliance.mjs            fails on rule violations
 *   node scripts/check-compliance.mjs --strict   also fails if a deliverable file still contains REPLACE-WITH
 *                                                (docs/, .kiro/, scripts/ and tests/ are exempt: they describe the marker)
 *
 * Rules (see .kiro/specs/project-bootstrap/requirements.md, requirement 1):
 *   1. LICENSE exists at the root and names an OSI-approved licence.
 *   2. No .gitignore rule ignores .kiro/ or anything inside it.
 *   3. README.md says the data is synthetic and not for clinical use.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OSI_NAMES = [/^MIT License/i, /Apache License/i, /BSD [23]-Clause/i, /GNU (General|Lesser|Affero)/i, /^ISC License/i, /Mozilla Public License/i];

/** Convert one .gitignore pattern to a function that tests a path prefix. Approximates git semantics. */
function patternMatcher(raw) {
  let p = raw;
  const dirOnly = p.endsWith('/');
  if (dirOnly) p = p.slice(0, -1);
  const anchored = p.startsWith('/') || p.slice(0, -1).includes('/');
  if (p.startsWith('/')) p = p.slice(1);
  let re = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*') {
      if (p[i + 1] === '*') {
        i++;
        if (p[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  const full = new RegExp('^' + re + '$');
  return { dirOnly, anchored, full };
}

/** True if the ignore lines cause `path` (relative, forward slashes) to be ignored. */
export function isIgnored(lines, path) {
  const parts = path.split('/');
  let ignored = false;
  for (const line0 of lines) {
    const line = line0.trim();
    if (!line || line.startsWith('#')) continue;
    const negated = line.startsWith('!');
    const { dirOnly, anchored, full } = patternMatcher(negated ? line.slice(1) : line);
    let matches = false;
    for (let n = 1; n <= parts.length; n++) {
      const isDir = n < parts.length || path.endsWith('/');
      if (dirOnly && !isDir) continue;
      const prefix = parts.slice(0, n).join('/');
      const subject = anchored ? prefix : parts[n - 1];
      if (full.test(subject)) { matches = true; break; }
    }
    if (matches) ignored = !negated;
  }
  return ignored;
}

export function checkAll(root = '.', strict = false) {
  const failures = [];

  // 1. licence
  const lic = join(root, 'LICENSE');
  if (!existsSync(lic)) failures.push('LICENSE: file not found at the repository root');
  else {
    const head = readFileSync(lic, 'utf8').split(/\r?\n/).slice(0, 5).join('\n');
    if (!OSI_NAMES.some((re) => re.test(head.trim()) || re.test(head))) failures.push('LICENSE: does not look like an OSI-approved licence (MIT, Apache, BSD, GPL, ISC, MPL)');
  }

  // 2. .kiro not ignored
  const gi = join(root, '.gitignore');
  const lines = existsSync(gi) ? readFileSync(gi, 'utf8').split(/\r?\n/) : [];
  for (const sample of ['.kiro/', '.kiro/steering/product.md', '.kiro/specs/merge-engine/requirements.md', '.kiro/hooks/protect-contract.json', '.kiro/settings/mcp.json', '.kiro/agents/ui-critic.json']) {
    if (isIgnored(lines, sample)) failures.push(`.gitignore: a rule ignores ${sample}. The .kiro directory must be committed.`);
  }
  if (!existsSync(join(root, '.kiro'))) failures.push('.kiro: directory not found');

  // 3. README
  const rd = join(root, 'README.md');
  if (!existsSync(rd)) failures.push('README.md: not found');
  else {
    const t = readFileSync(rd, 'utf8').toLowerCase();
    if (!t.includes('synthetic')) failures.push('README.md: must state that all data is synthetic');
    if (!t.includes('not for clinical use')) failures.push('README.md: must say "not for clinical use"');
  }

  // strict: no placeholders left
  if (strict) {
    const skip = new Set(['node_modules', '.git', 'dist', 'coverage']);
    // These directories talk about the marker, so a mention there is not an unfilled placeholder.
    const exempt = ['docs/', '.kiro/', 'scripts/', 'tests/'];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        if (skip.has(name)) continue;
        const p = join(dir, name);
        const rel = p.replace(root + '/', '');
        if (exempt.some((e) => (rel + '/').startsWith(e))) continue;
        const s = statSync(p);
        if (s.isDirectory()) walk(p);
        else if (s.size < 2_000_000 && /\.(md|json|ts|tsx|css|html|mjs|yml|yaml|txt)$|^LICENSE$/.test(name)) {
          readFileSync(p, 'utf8').split(/\r?\n/).forEach((l, i) => {
            if (l.includes('REPLACE-WITH')) failures.push(`${p.replace(root + '/', '')}:${i + 1}: placeholder REPLACE-WITH still present`);
          });
        }
      }
    };
    walk(root);
  }
  return failures;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const failures = checkAll('.', process.argv.includes('--strict'));
  if (failures.length) {
    console.error('Compliance check failed:\n- ' + failures.join('\n- '));
    process.exit(1);
  }
  console.log('Compliance check passed.');
}
