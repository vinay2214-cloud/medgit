/**
 * Summary bar, reconciled list, commit panel, marker view and problems panel.
 * Validates: review-ui 3.1 to 3.5, 7.1 to 7.4, 8.1 to 8.4, 10.1 to 10.3, 12.1 to 12.3
 */
import { forwardRef, useState, type KeyboardEvent } from 'react';
import { Check, CircleCheck, Copy, GitCommitHorizontal, TriangleAlert, UserRoundCheck } from 'lucide-react';
import { MESSAGE_MAX, renderConflictMarkers, type Conflict, type ConflictId, type ConflictState, type Role } from '@core';
import { copy, copyForError, roleLabel } from '../copy';
import { showFrequency, showStatus, showStrength, showTime, shortId } from '../format';
import { cn } from '../lib/utils';
import type { Counters, MergedView } from '../state/selectors';
import type { BoardView, Filter, UiError } from '../state/types';
import { segmentItem } from '../shell/Controls';
import { KindPill, SeamLine, StatePill, type SeamState } from './Primitives';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

// ------------------------------------------------------------------ summary bar

export function SummaryBar({ counters, filter, boardView, onFilter, onBoardView }: { counters: Counters; filter: Filter; boardView: BoardView; onFilter: (f: Filter) => void; onBoardView: (v: BoardView) => void }) {
  const counter = 'inline-flex items-center gap-2 h-10 px-3 rounded-[var(--radius-row)] text-body font-semibold tabular-nums';
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3 border-b border-line">
      <ul className="flex flex-wrap items-center gap-2" aria-label="Summary">
        <li data-testid="counter-open" className={cn(counter, counters.toDecide ? 'bg-conflict-bg text-conflict' : 'bg-resolved-bg text-resolved')}>
          {counters.toDecide ? <TriangleAlert size={18} aria-hidden="true" /> : <CircleCheck size={18} aria-hidden="true" />}
          {copy.summary.toDecide(counters.toDecide)}
        </li>
        <li data-testid="counter-escalated" className={cn(counter, counters.escalated ? 'bg-escalated-bg text-escalated' : 'bg-surface-2 text-ink-muted')}>
          <UserRoundCheck size={18} aria-hidden="true" />
          {copy.summary.escalated(counters.escalated)}
        </li>
        <li data-testid="counter-agreed" className={cn(counter, 'bg-agreed-bg text-agreed')}>
          <Check size={18} aria-hidden="true" />
          {copy.summary.agreed(counters.agreed)}
        </li>
      </ul>
      <div className="flex flex-wrap items-center gap-4 ml-auto min-w-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span id="filter-label" className="text-small text-ink-muted">{copy.summary.filter}</span>
          <ToggleGroup type="single" value={filter} aria-labelledby="filter-label" className="rounded-[var(--radius-row)] border border-line-strong p-0.5 gap-0.5 flex-wrap justify-start" onValueChange={(v) => v && onFilter(v as Filter)}>
            {(['all', 'open', 'escalated', 'resolved'] as const).map((f) => (
              <ToggleGroupItem key={f} value={f} data-testid={`filter-${f}`} size="sm" className={segmentItem}>
                {copy.summary.filters[f]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex items-center gap-2">
          <span id="view-label" className="text-small text-ink-muted">{copy.summary.view}</span>
          <ToggleGroup type="single" value={boardView} aria-labelledby="view-label" className="rounded-[var(--radius-row)] border border-line-strong p-0.5 gap-0.5" onValueChange={(v) => v && onBoardView(v as BoardView)}>
            <ToggleGroupItem value="chart" data-testid="view-chart" size="sm" className={segmentItem}>{copy.summary.chart}</ToggleGroupItem>
            <ToggleGroupItem value="markers" data-testid="view-markers" size="sm" className={segmentItem}>{copy.summary.markers}</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ reconciled list

export function MergedList({ view }: { view: MergedView }) {
  return (
    <section aria-labelledby="merged-title" className="bg-surface border border-line rounded-[var(--radius-row)]" data-testid="merged-list">
      <header className="px-4 py-3 border-b border-line">
        <h2 id="merged-title" className="text-heading font-semibold text-ink">{copy.merged.title}</h2>
        <p className="text-small text-ink-muted tabular-nums" data-testid="merged-sub">{copy.merged.sub(view.lines.length, view.waiting.length)}</p>
      </header>
      <ul className="divide-y divide-line">
        {view.lines.map(({ entry, provenance }, i) => (
          <li key={entry.drugKey} data-testid={`merged-line-${entry.drugKey}`} className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2', i % 2 === 1 && 'bg-surface-2')}>
            <span className="flex-1 min-w-[12rem] font-semibold text-ink wrap-anywhere">{entry.displayName}</span>
            <span className="text-data tabular-nums text-ink">
              {[showStrength(entry.strength) ?? copy.cell.unreadable, showFrequency(entry.frequency) ?? copy.cell.unreadable, showStatus(entry.status)].join(', ')}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 h-6 px-2.5 rounded-[var(--radius-pill)] text-small font-semibold',
                provenance.kind === 'agreed' ? 'bg-agreed-bg text-agreed' : provenance.kind === 'manual' ? 'bg-escalated-bg text-escalated' : 'bg-resolved-bg text-resolved',
              )}
            >
              {provenance.kind === 'agreed' ? <Check size={14} aria-hidden="true" /> : <CircleCheck size={14} aria-hidden="true" />}
              {provenance.kind === 'agreed' ? copy.merged.agreed : provenance.kind === 'manual' ? copy.merged.manual : copy.merged.decided(copy.reason[provenance.reason])}
            </span>
          </li>
        ))}
        {view.waiting.map((w) => (
          <li key={w.drugKey} data-testid={`merged-waiting-${w.drugKey}`} className="flex items-center gap-2 px-4 py-2 text-conflict italic">
            <TriangleAlert size={14} aria-hidden="true" />
            {copy.merged.waiting(w.displayName)}
          </li>
        ))}
      </ul>
      {view.excludedCount > 0 && <p className="px-4 py-2 border-t border-line text-small text-ink-muted" data-testid="merged-excluded">{copy.merged.left(view.excludedCount)}</p>}
    </section>
  );
}

// ------------------------------------------------------------------ commit panel

interface CommitPanelProps {
  pendingCount: number;
  escalatedOnly: boolean;
  canCommit: boolean;
  message: string;
  role: Role;
  error: UiError | null;
  lastCommit: { id: string; role: Role; at: string } | null;
  sticky: boolean;
  onMessage: (text: string) => void;
  onCommit: () => void;
}

export const CommitPanel = forwardRef<HTMLTextAreaElement, CommitPanelProps>(function CommitPanel(p, messageRef) {
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const seam: SeamState = p.canCommit ? 'resolved' : p.escalatedOnly ? 'escalated' : 'open';
  const empty = p.message.trim() === '';
  const showEmptyError = submitted && empty && p.canCommit;
  const commitError = p.error?.where === 'commit' ? p.error : null;
  const errId = 'commit-message-error';

  const submit = () => {
    setSubmitted(true);
    if (!p.canCommit || empty) return;
    setSubmitted(false);
    p.onCommit();
  };

  return (
    <section aria-labelledby="commit-title" className={cn('bg-surface border border-line rounded-[var(--radius-row)] relative', p.sticky && 'sticky bottom-0 z-10 shadow-[var(--shadow-pop)]')} data-testid="commit-panel">
      <SeamLine state={seam} className="absolute top-0 left-0" />
      <div className="px-4 pt-4 pb-4 flex flex-col gap-3">
        <h2 id="commit-title" className="text-heading font-semibold text-ink flex items-center gap-2">
          <GitCommitHorizontal size={20} aria-hidden="true" />
          {copy.commit.title}
        </h2>
        {!p.canCommit && (
          <p className="text-body text-ink" data-testid="commit-disabled-reason">
            {copy.commit.disabled(p.pendingCount)}
          </p>
        )}
        <label htmlFor="commit-message" className={cn('flex flex-col gap-1 text-body font-semibold text-ink', p.sticky && !p.canCommit && 'sr-only')}>
          {copy.commit.message}
          <Textarea
            ref={messageRef}
            id="commit-message"
            data-testid="commit-message"
            data-focus-id="commit-message"
            rows={2}
            maxLength={MESSAGE_MAX}
            disabled={!p.canCommit}
            value={p.message}
            required
            aria-invalid={showEmptyError}
            aria-describedby={`commit-count${showEmptyError || commitError ? ` ${errId}` : ''}`}
            onChange={(e) => p.onMessage(e.target.value)}
            className="font-normal"
          />
          <span id="commit-count" className="text-small font-normal text-ink-muted text-right tabular-nums">
            {p.message.length} / {MESSAGE_MAX}
          </span>
        </label>
        {(showEmptyError || commitError) && (
          <p id={errId} role="alert" className="text-small text-conflict font-semibold">
            {showEmptyError ? copy.err.MESSAGE_REQUIRED : copyForError(commitError?.code ?? 'generic')}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button data-testid="sign-off" disabled={!p.canCommit} onClick={submit}>
            {copy.commit.cta}
          </Button>
          <span className="text-small text-ink-muted">{roleLabel(p.role)}</span>
        </div>
        {p.lastCommit && (
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-[var(--radius-row)] bg-resolved-bg text-resolved" data-testid="commit-success">
            <CircleCheck size={18} aria-hidden="true" />
            <code className="font-mono text-mono font-semibold" data-testid="commit-id">{shortId(p.lastCommit.id)}</code>
            <Button
              variant="ghost"
              size={copied ? 'default' : 'icon'}
              aria-label={copy.commit.copy}
              onClick={() => {
                void navigator.clipboard?.writeText(p.lastCommit?.id ?? '').then(() => setCopied(true), () => setCopied(false));
              }}
            >
              <Copy size={14} aria-hidden="true" />
              {copied ? copy.commit.copied : null}
            </Button>
            <span className="text-small">{copy.commit.done(roleLabel(p.lastCommit.role), showTime(p.lastCommit.at))}</span>
            <a href="#/history" data-testid="history-link" data-focus-id="history-link" className="text-small font-semibold text-violet underline underline-offset-4">
              {copy.commit.viewHistory}
            </a>
          </div>
        )}
      </div>
    </section>
  );
});

// ------------------------------------------------------------------ marker view

export function MarkerView({ conflicts, states, selectedId, onSelect }: { conflicts: Conflict[]; states: Record<ConflictId, ConflictState>; selectedId: ConflictId | null; onSelect: (id: ConflictId) => void }) {
  if (conflicts.length === 0) return <p className="p-6 bg-surface border border-line rounded-[var(--radius-row)] text-ink-muted">{copy.empty.noConflicts}</p>;
  const onKey = (e: KeyboardEvent, id: ConflictId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
    }
  };
  return (
    <ul className="flex flex-col gap-3" aria-label={copy.summary.markers} data-testid="markers">
      {conflicts.map((c) => {
        const st = states[c.id] ?? 'open';
        return (
          <li key={c.id}>
            <div
              role="button"
              tabIndex={0}
              aria-pressed={c.id === selectedId}
              data-testid={`marker-${c.id}`}
              onClick={() => onSelect(c.id)}
              onKeyDown={(e) => onKey(e, c.id)}
              className={cn('block bg-surface border border-line rounded-[var(--radius-row)] p-3 cursor-pointer hover:bg-surface-2', c.id === selectedId && 'shadow-[inset_3px_0_0_var(--violet)]')}
            >
              <span className="flex flex-wrap gap-2 mb-2">
                <StatePill state={st === 'superseded' ? 'superseded' : st} />
                <KindPill kind={c.kind} state={st} />
              </span>
              <pre className="font-mono text-mono text-ink whitespace-pre-wrap wrap-anywhere">{renderConflictMarkers(c)}</pre>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ------------------------------------------------------------------ problems panel

export function IssuesPanel({ groups, open, onToggle }: { groups: { sourceId: string; label: string; issues: { code: string; itemIndex: number; text: string; name: string }[] }[]; open: boolean; onToggle: (open: boolean) => void }) {
  if (groups.length === 0) return null;
  const count = groups.reduce((n, g) => n + g.issues.length, 0);
  return (
    <details id="problems" className="bg-escalated-bg border border-line rounded-[var(--radius-row)] text-ink" data-testid="problems-panel" open={open} onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer px-4 py-3 font-semibold text-escalated flex items-center gap-2 min-h-10">
        <TriangleAlert size={18} aria-hidden="true" />
        {copy.problems.title} ({count})
      </summary>
      <div className="px-4 pb-4 flex flex-col gap-3">
        {groups.map((g) => (
          <div key={g.sourceId}>
            <h3 className="text-small font-semibold text-ink">{g.label}</h3>
            <ul className="list-disc pl-5 text-small text-ink">
              {g.issues.map((i, k) => {
                const fn = copy.problems[i.code as keyof typeof copy.problems];
                const text = typeof fn === 'function' ? fn(i.code === 'UNMAPPED_DRUG' || i.code === 'DUPLICATE_DRUG' ? i.name : i.text) : i.code;
                return <li key={k} className="wrap-anywhere">{text}</li>;
              })}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
