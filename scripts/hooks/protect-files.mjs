#!/usr/bin/env node
/**
 * Kiro PreToolUse hook: stop agents from editing the project's contract files.
 *
 * Kiro runs this command before a write or shell tool call and sends the call as JSON on STDIN
 * (fields include tool_name and tool_input). Exit code 2 (any non-zero exit) blocks the call and
 * the message on STDERR is sent to the agent.
 *
 * This is a safety rail against accidental drift, not a security boundary. The human can edit these
 * files in an editor at any time. To let an agent edit them for one session, start Kiro with
 * MEDGIT_ALLOW_PROTECTED=1 in the environment.
 *
 * Plain Node, no dependencies. Fails open if the input cannot be read (never blocks by accident).
 */
import { readFileSync } from 'node:fs';

const PROTECTED = [
  [/^\.kiro\/specs\/[^/]+\/requirements\.md$/, 'requirements are the contract'],
  [/^LICENSE$/, 'the licence text'],
  [/^\.env(\..*)?$/, 'environment and secrets files'],
  [/^data\/scenarios\/[^/]+\.json$/, 'golden scenario data'],
  [/^data\/vectors\/[^/]+\.json$/, 'golden hash vectors'],
  [/^data\/formulary\.json$/, 'golden formulary'],
  [/^docs\/MERGE_SEMANTICS\.md$/, 'merge semantics source of truth'],
  [/^docs\/PRD\.md$/, 'product requirements'],
  [/^docs\/UX_SPEC\.md$/, 'UX specification and copy deck'],
  [/^docs\/DESIGN_SYSTEM\.md$/, 'design system'],
  [/^\.kiro\/allow-protected$/, 'the human-only override switch'],
];

const WRITE_TOOLS = /write|replace|edit|create|insert|patch/i;
const SHELL_TOOLS = /shell|execute_bash|execute_pwsh|bash|pwsh/i;
const SHELL_WRITES = /(^|[\s;&|(])(tee|mv|cp|rm|truncate|dd|install|ln)\s|>>?|\bsed\s+(-[a-zA-Z]*i|--in-place)|\bperl\s+-[a-zA-Z]*i|\bgit\s+(checkout|restore|reset|stash|clean)\b|\bsort\s+-o\b/;

function readStdin() {
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

function strings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}

function normalise(p, cwd) {
  let s = p.replace(/\\/g, '/').trim();
  if (cwd) {
    const c = cwd.replace(/\\/g, '/').replace(/\/$/, '') + '/';
    if (s.startsWith(c)) s = s.slice(c.length);
  }
  return s.replace(/^\.\//, '');
}

function protectedReason(rel) {
  for (const [re, why] of PROTECTED) if (re.test(rel)) return why;
  return null;
}

function main() {
  if (process.env.MEDGIT_ALLOW_PROTECTED === '1') return 0;
  let payload;
  try { payload = JSON.parse(readStdin()); } catch { return 0; }
  if (!payload || typeof payload !== 'object') return 0;

  const toolName = String(payload.tool_name ?? '');
  const cwd = typeof payload.cwd === 'string' ? payload.cwd : '';
  const input = payload.tool_input ?? {};
  const all = strings(input);

  let hit = null;
  if (SHELL_TOOLS.test(toolName) && !WRITE_TOOLS.test(toolName)) {
    // Shell: block only commands that look like they write, and that mention a protected path.
    for (const cmd of all) {
      if (!SHELL_WRITES.test(cmd)) continue;
      const words = cmd.split(/[\s'"=;&|()<>]+/).filter(Boolean);
      for (const w of words) {
        const why = protectedReason(normalise(w, cwd));
        if (why) { hit = [normalise(w, cwd), why]; break; }
      }
      if (hit) break;
    }
  } else if (WRITE_TOOLS.test(toolName) || toolName === '') {
    // Write tools: path-like strings are short and single-line (file contents usually are not).
    for (const s of all) {
      if (s.length > 300 || s.includes('\n')) continue;
      const rel = normalise(s, cwd);
      const why = protectedReason(rel);
      if (why) { hit = [rel, why]; break; }
    }
  }

  if (!hit) return 0;
  process.stderr.write(
    `Blocked by the MedGit protect-contract hook: ${hit[0]} is protected (${hit[1]}).\n` +
    'Do not edit it. If the file is wrong or something is missing, stop and ask the human. ' +
    'The human can change it directly, or start Kiro with MEDGIT_ALLOW_PROTECTED=1 to allow it for a session.\n'
  );
  return 2;
}

process.exit(main());
