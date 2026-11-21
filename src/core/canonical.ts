/**
 * Canonical JSON and SHA-256 (docs/MERGE_SEMANTICS.md section 6).
 * Keys sorted by UTF-16 code unit at every depth, no whitespace, array order kept,
 * undefined properties omitted, numbers as JSON.stringify prints them, non-finite numbers rejected.
 * Validates history-audit 2.1 to 2.5.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { err, ok, type CanonicalError, type Result } from './errors';

class CanonicalFailure {
  constructor(readonly path: string) {}
}

function isPlainObject(v: object): boolean {
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function childPath(path: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? (path === '' ? key : `${path}.${key}`) : `${path}[${JSON.stringify(key)}]`;
}

function emit(value: unknown, path: string): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) throw new CanonicalFailure(path);
      return JSON.stringify(value);
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        const parts: string[] = [];
        for (let i = 0; i < value.length; i++) {
          const item: unknown = value[i];
          if (item === undefined) throw new CanonicalFailure(`${path}[${i}]`);
          parts.push(emit(item, `${path}[${i}]`));
        }
        return `[${parts.join(',')}]`;
      }
      if (!isPlainObject(value)) throw new CanonicalFailure(path);
      const rec = value as Record<string, unknown>;
      const keys = Object.keys(rec)
        .filter((k) => rec[k] !== undefined)
        .sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${emit(rec[k], childPath(path, k))}`).join(',')}}`;
    }
    default:
      throw new CanonicalFailure(path);
  }
}

export function canonicalise(value: unknown): Result<string, CanonicalError> {
  try {
    return ok(emit(value, ''));
  } catch (e) {
    if (e instanceof CanonicalFailure) return err({ code: 'CANONICAL_INVALID', path: e.path });
    return err({ code: 'CANONICAL_INVALID', path: '' }); // for example a cycle (stack overflow)
  }
}

/** Lower-case hex SHA-256 of the UTF-8 bytes of the text. */
export function sha256Hex(text: string): string {
  return bytesToHex(sha256(utf8ToBytes(text)));
}

/** Deep copy of plain JSON-like data. Not structuredClone: core compiles without DOM types. */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v: unknown) => deepClone(v)) as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== undefined) out[k] = deepClone(v);
  }
  return out as T;
}
