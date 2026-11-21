/**
 * Small presentational pieces: SeamLine, StatePill, KindPill, SourceChip, Mark.
 * Colour is never the only signal: every pill has an icon and a word.
 */
import type { CSSProperties } from 'react';
import { Check, CircleCheck, CircleSlash, TriangleAlert, UserRoundCheck } from 'lucide-react';
import type { ConflictKind, ConflictState } from '@core';
import { copy } from '../copy';
import { cn } from '../lib/utils';
import type { RowState } from '../state/selectors';

export type SeamState = 'open' | 'escalated' | 'resolved';

/** Validates: review-ui 5.1, 5.4 */
export function SeamLine({ state, className, style }: { state: SeamState; className?: string; style?: CSSProperties }) {
  return (
    <svg className={cn('seam pointer-events-none block', className)} data-state={state} aria-hidden="true" focusable="false" height="6" width="100%" style={style}>
      <line x1="2" y1="3" x2="99%" y2="3" />
    </svg>
  );
}

const STATE_STYLE: Record<RowState, { cls: string; Icon: typeof Check; label: string }> = {
  open: { cls: 'bg-conflict-bg text-conflict', Icon: TriangleAlert, label: copy.state.open },
  escalated: { cls: 'bg-escalated-bg text-escalated', Icon: UserRoundCheck, label: copy.state.escalated },
  resolved: { cls: 'bg-resolved-bg text-resolved', Icon: CircleCheck, label: copy.state.resolved },
  superseded: { cls: 'bg-surface-2 text-ink-muted', Icon: CircleSlash, label: copy.state.superseded },
  agreed: { cls: 'bg-agreed-bg text-agreed', Icon: Check, label: copy.state.agreed },
};

const pillBase = 'inline-flex items-center gap-1.5 h-6 px-2.5 rounded-[var(--radius-pill)] text-small font-semibold whitespace-nowrap';

export function StatePill({ state, className }: { state: RowState; className?: string }) {
  const s = STATE_STYLE[state];
  return (
    <span className={cn(pillBase, s.cls, className)} data-pill-state={state}>
      <s.Icon size={14} strokeWidth={2} aria-hidden="true" />
      {s.label}
    </span>
  );
}

/** A conflict-kind pill, coloured by that conflict's state. */
export function KindPill({ kind, state, className }: { kind: ConflictKind; state: ConflictState; className?: string }) {
  const s = STATE_STYLE[state];
  const Icon = kind === 'OMISSION' ? CircleSlash : s.Icon;
  return (
    <span className={cn(pillBase, s.cls, className)} data-kind={kind}>
      <Icon size={14} strokeWidth={2} aria-hidden="true" />
      {copy.kind[kind]}
    </span>
  );
}

const KNOWN_SOURCES = ['hospital', 'gp', 'pharmacy', 'patient'] as const;

/** CSS colour for a source thread. Unknown ids take the next of the four colours by sorted index. */
export function threadColour(sourceId: string, sortedIndex: number): string {
  const known = (KNOWN_SOURCES as readonly string[]).includes(sourceId) ? sourceId : KNOWN_SOURCES[sortedIndex % 4];
  return `var(--src-${known})`;
}

export function threadStyle(sourceId: string, sortedIndex: number): CSSProperties {
  return { ['--thread' as string]: threadColour(sourceId, sortedIndex) };
}

export function SourceChip({ sourceId, index, label, className }: { sourceId: string; index: number; label: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 min-w-0', className)} style={threadStyle(sourceId, index)}>
      <span className="thread-dot" aria-hidden="true" />
      <span className="font-semibold text-ink wrap-anywhere">{label}</span>
    </span>
  );
}

/** Product mark: a small seam glyph and the name. */
export function Mark() {
  return (
    <span className="inline-flex items-center gap-2 text-title font-bold text-ink">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" focusable="false" className="seam" data-state="resolved">
        <rect x="3" y="5" width="22" height="18" rx="4" fill="none" stroke="var(--violet)" strokeWidth="2" />
        <line x1="7" y1="14" x2="21" y2="14" style={{ stroke: 'var(--violet)', strokeDasharray: '3 2.5' }} />
      </svg>
      {copy.app.title}
    </span>
  );
}
