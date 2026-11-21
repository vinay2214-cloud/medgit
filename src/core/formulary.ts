/**
 * Formulary loading and alias index.
 * Validates formulary-normaliser 1.1, 1.2, 1.3, 1.4.
 */

import { err, ok, type FormularyError, type Result } from './errors';
import { compareCodeUnits, tokens } from './text';
import type { Formulary, FormularyItem, Unit } from './types';

const UNITS: readonly Unit[] = ['mg', 'mcg', 'ml', 'iu'];
const STRING_FIELDS = ['id', 'ingredient', 'display', 'form', 'route'] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function invalid(message: string): { ok: false; error: FormularyError } {
  return err({ code: 'FORMULARY_INVALID', message });
}

function parseItem(raw: unknown, index: number): Result<FormularyItem, FormularyError> {
  if (!isRecord(raw)) return invalid(`items[${index}] is not an object`);
  for (const f of STRING_FIELDS) {
    const v = raw[f];
    if (typeof v !== 'string' || v.trim() === '') return invalid(`items[${index}] lacks the field ${f}`);
  }
  const unit = raw.canonicalUnit;
  if (typeof unit !== 'string' || !(UNITS as readonly string[]).includes(unit)) {
    return invalid(`items[${index}] lacks a valid canonicalUnit`);
  }
  const strengths = raw.strengths;
  if (
    !Array.isArray(strengths) ||
    !strengths.every(
      (s) => Array.isArray(s) && s.length >= 1 && s.every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0),
    )
  ) {
    return invalid(`items[${index}] lacks valid strengths`);
  }
  const aliases = raw.aliases;
  if (!Array.isArray(aliases) || aliases.length === 0 || !aliases.every((a) => typeof a === 'string')) {
    return invalid(`items[${index}] lacks the field aliases`);
  }
  return ok({
    id: raw.id as string,
    ingredient: raw.ingredient as string,
    display: raw.display as string,
    form: raw.form as string,
    route: raw.route as string,
    canonicalUnit: unit as Unit,
    strengths: (strengths as number[][]).map((s) => [...s]),
    aliases: [...(aliases as string[])],
  });
}

export function loadFormulary(json: unknown): Result<Formulary, FormularyError> {
  if (!isRecord(json)) return invalid('formulary is not an object');
  if (json.schema !== 'medgit.formulary/1') return invalid(`schema must be medgit.formulary/1, got ${String(json.schema)}`);
  const rawItems = json.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) return invalid('items list is empty');

  const items: FormularyItem[] = [];
  const byId = new Map<string, FormularyItem>();
  for (let i = 0; i < rawItems.length; i++) {
    const r = parseItem(rawItems[i], i);
    if (!r.ok) return r;
    if (byId.has(r.value.id)) return invalid(`two items share the id ${r.value.id}`);
    byId.set(r.value.id, r.value);
    items.push(r.value);
  }

  const seen = new Map<string, string>();
  const aliases: { tokens: string[]; id: string }[] = [];
  for (const item of items) {
    for (const alias of item.aliases) {
      const toks = tokens(alias);
      if (toks.length === 0) return invalid(`alias "${alias}" of ${item.id} is empty after normalisation`);
      const key = toks.join(' ');
      const owner = seen.get(key);
      if (owner !== undefined && owner !== item.id) {
        return invalid(`items ${owner} and ${item.id} share the alias "${key}"`);
      }
      if (owner === undefined) {
        seen.set(key, item.id);
        aliases.push({ tokens: toks, id: item.id });
      }
    }
  }
  aliases.sort((a, b) => b.tokens.length - a.tokens.length || compareCodeUnits(a.tokens.join(' '), b.tokens.join(' ')));
  return ok({ items, byId, aliases });
}
