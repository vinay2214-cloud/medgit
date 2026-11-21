/**
 * Git-style text conflict markers (docs/UX_SPEC.md section 5.7).
 *
 *   metformin-tab  FREQUENCY
 *   <<<<<<< gp, hospital, pharmacy
 *   2/day
 *   =======
 *   1/day
 *   >>>>>>> patient
 *
 * Claimants with the same value share a group; groups are ordered by their first source id.
 * With more than two groups, each middle group is introduced by "======= <sources>" so that every
 * value stays attributed to its sources.
 * Validates merge-engine 3.1 to 3.4 (presentation of claims).
 */

import { fieldOfKind, formatField } from './merge';
import { formatFrequency, formatStrength } from './normalise/index';
import { compareCodeUnits } from './text';
import type { Conflict, MedEntry, MergeSourceInfo } from './types';

function claimText(conflict: Conflict, entry: MedEntry | null): string {
  if (conflict.kind === 'OMISSION') {
    if (entry === null) return '(not listed)';
    return `listed: ${formatStrength(entry.strength)}, ${formatFrequency(entry.frequency)}, ${entry.status}`;
  }
  return entry === null ? '(not listed)' : formatField(fieldOfKind(conflict.kind), entry);
}

export function renderConflictMarkers(conflict: Conflict): string {
  const groups = new Map<string, string[]>();
  for (const claim of conflict.claims) {
    const text = claimText(conflict, claim.entry);
    const list = groups.get(text) ?? [];
    list.push(claim.source);
    groups.set(text, list);
  }
  const ordered = [...groups.entries()]
    .map(([text, ids]) => ({ text, ids: [...ids].sort(compareCodeUnits) }))
    .sort((a, b) => compareCodeUnits(a.ids[0] ?? '', b.ids[0] ?? ''));

  const lines = [`${conflict.drugKey}  ${conflict.kind}`];
  ordered.forEach((g, i) => {
    const ids = g.ids.join(', ');
    if (i === 0) lines.push(`<<<<<<< ${ids}`);
    else if (i < ordered.length - 1) lines.push(`======= ${ids}`);
    else lines.push('=======');
    lines.push(g.text);
    if (i === ordered.length - 1 && ordered.length > 1) lines.push(`>>>>>>> ${ids}`);
  });
  if (ordered.length === 1) lines.push('>>>>>>>');
  return `${lines.join('\n')}\n`;
}

/** One block per conflict in the given order, separated by one blank line, ending with a newline. */
export function renderMarkers(conflicts: Conflict[], sources: MergeSourceInfo[] = []): string {
  void sources; // labels stay as source ids so the text is stable and testable
  return conflicts.map(renderConflictMarkers).join('\n');
}
