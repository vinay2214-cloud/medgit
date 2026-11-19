#!/usr/bin/env node
/**
 * Fail if a hard-coded colour appears in src/ui outside src/ui/styles/tokens.css.
 * Used by the ui-no-hex hook. The same rule is enforced in tests/no-hex-colours.test.ts.
 * Exit 1 with file:line messages on STDERR if anything is found.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'src/ui';
const TOKENS = 'src/ui/styles/tokens.css'.replace(/\\/g, '/');
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const FUNC = /\b(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else if (/\.(tsx?|css)$/.test(name)) yield p;
  }
}

if (!existsSync(ROOT)) {
  console.log('check-hex: src/ui not found yet, skipped');
  process.exit(0);
}

const problems = [];
for (const file of walk(ROOT)) {
  const rel = relative('.', file).replace(/\\/g, '/');
  if (rel === TOKENS) continue;
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (/href=|to=|id=|aria-|data-/.test(line) && !FUNC.test(line)) {
      // anchors like href="#add" are not colours
      const stripped = line.replace(/(href|to|id|htmlFor|aria-[a-z]+|data-[a-z-]+)=["'{][^"'}]*["'}]/g, '');
      if (!HEX.test(stripped)) return;
    }
    if (HEX.test(line) || FUNC.test(line)) problems.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
  });
}

if (problems.length) {
  process.stderr.write(
    'Hard-coded colours found. Use tokens from src/ui/styles/tokens.css through Tailwind names or var(--token).\n' +
    problems.join('\n') + '\n'
  );
  process.exit(1);
}
console.log('check-hex: ok');
