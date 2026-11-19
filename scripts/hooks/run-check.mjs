#!/usr/bin/env node
/**
 * Run one or more npm scripts quietly; print nothing on success except a short line,
 * and print the tail of the output to STDERR on failure with exit 1.
 * Kiro adds STDOUT to the agent context on exit 0 and STDERR on any other exit, so this keeps
 * the agent informed only when something is wrong.
 *
 *   node scripts/hooks/run-check.mjs typecheck test:props:fast
 *
 * Skips quietly while the project is not set up yet (no package.json, or the script is not defined).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const names = process.argv.slice(2);
if (names.length === 0) {
  console.log('run-check: no scripts given');
  process.exit(0);
}
if (!existsSync('package.json')) {
  console.log('run-check: package.json not found yet, skipped');
  process.exit(0);
}
let scripts = {};
try { scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts ?? {}; } catch { /* ignore */ }

const ran = [];
for (const name of names) {
  if (!scripts[name]) continue;
  const r = spawnSync('npm', ['run', name, '--silent'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (r.status !== 0) {
    const text = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
    const tail = text.length > 6000 ? '...\n' + text.slice(-6000) : text;
    process.stderr.write(`npm run ${name} failed. Fix this before continuing.\n${tail}\n`);
    process.exit(1);
  }
  ran.push(name);
}
console.log(ran.length ? `ok: ${ran.join(', ')}` : 'run-check: nothing to run yet');
