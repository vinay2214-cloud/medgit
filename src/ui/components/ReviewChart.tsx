/**
 * The medication chart: medicines by source, a seam under every disagreement.
 * One tab stop (roving tabindex), Up/Down/Home/End move, Enter/Space select.
 * Validates: review-ui 4.1 to 4.10, 5.1 to 5.6
 */
import { forwardRef, useRef, useState, type KeyboardEvent } from 'react';
import { Check } from 'lucide-react';
import type { MedEntry, MergeSourceInfo } from '@core';
import { copy } from '../copy';
import { showFrequency, showStatus, showStrength, showTime } from '../format';
import { cn } from '../lib/utils';
import type { ChartCell, ChartRow, RowState } from '../state/selectors';
import { KindPill, SeamLine, SourceChip, StatePill, threadStyle, type SeamState } from './Primitives';

export function rowAccessibleName(row: ChartRow): string {
  if (row.conflicts.length === 0) return `${row.displayName}. Agreed.`;
  const kinds = row.conflicts.map((c) => copy.kindConflict[c.kind]).join(' and ');
  return `${row.displayName}. ${kinds}. ${copy.state[row.rowState === 'agreed' ? 'agreed' : row.rowState]}.`;
}

function seamState(s: RowState): SeamState | null {
  return s === 'open' ? 'open' : s === 'escalated' ? 'escalated' : s === 'resolved' ? 'resolved' : null;
}

interface CellValueProps {
  cell: ChartCell;
  index: number;
  unreadableLink: (() => void) | null;
}

function Line({ text, marked, chosen, strong, index, sourceId }: { text: string; marked: boolean; chosen: boolean; strong?: boolean; index: number; sourceId: string }) {
  return (
    <span className={cn('block wrap-anywhere', strong && 'font-semibold')}>
      <span className={cn(marked && 'thread-mark')} style={marked ? threadStyle(sourceId, index) : undefined}>
        {text}
      </span>
      {chosen && <Check size={14} strokeWidth={2.5} className="inline ml-1 text-resolved align-[-2px]" aria-label="chosen" />}
    </span>
  );
}

export function CellValue({ cell, index, unreadableLink }: CellValueProps) {
  const e: MedEntry | null = cell.entry;
  if (e === null) {
    const marked = cell.inConflict.includes('omission');
    return (
      <span className={cn('block italic text-ink-muted', marked && 'thread-mark')} style={marked ? threadStyle(cell.sourceId, index) : undefined}>
        {copy.row.notListed}
      </span>
    );
  }
  const unreadable = (
    <span className="text-conflict">
      {copy.cell.unreadable}
      {unreadableLink && (
        <button type="button" tabIndex={-1} className="ml-1 underline text-small" onClick={(ev) => { ev.stopPropagation(); unreadableLink(); }}>
          {copy.problems.link}
        </button>
      )}
    </span>
  );
  const strength = showStrength(e.strength);
  const freq = showFrequency(e.frequency);
  return (
    <span className="block text-data leading-[1.4] tabular-nums">
      {strength === null ? <span className="block font-semibold">{unreadable}</span> : <Line text={strength} strong marked={cell.inConflict.includes('strength')} chosen={cell.chosen.includes('strength')} index={index} sourceId={cell.sourceId} />}
      {freq === null ? <span className="block">{unreadable}</span> : <Line text={freq} marked={cell.inConflict.includes('frequency')} chosen={cell.chosen.includes('frequency')} index={index} sourceId={cell.sourceId} />}
      {(e.status !== 'active' || cell.inConflict.includes('status')) && (
        <Line text={showStatus(e.status)} marked={cell.inConflict.includes('status')} chosen={cell.chosen.includes('status')} index={index} sourceId={cell.sourceId} />
      )}
    </span>
  );
}

function RowPills({ row }: { row: ChartRow }) {
  if (row.conflicts.length === 0) return <StatePill state="agreed" />;
  return (
    <span className="flex flex-col items-start gap-1">
      <StatePill state={row.rowState} />
      {row.conflicts.map((c) => (
        <KindPill key={c.id} kind={c.kind} state={c.state} />
      ))}
    </span>
  );
}

interface ChartProps {
  rows: ChartRow[];
  sources: MergeSourceInfo[];
  selectedDrugKey: string | null;
  onSelect: (row: ChartRow) => void;
  openProblems: (() => void) | null;
  problemSources: Set<string>;
}

/** Desktop and tablet: an ARIA grid with roving tabindex. */
export const ReviewChart = forwardRef<HTMLDivElement, ChartProps>(function ReviewChart({ rows, sources, selectedDrugKey, onSelect, openProblems, problemSources }, ref) {
  const [active, setActive] = useState(0);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const selectedIndex = rows.findIndex((r) => r.drugKey === selectedDrugKey);
  const activeIndex = Math.min(active, Math.max(rows.length - 1, 0));

  // keep the tab stop on the selected row when the selection changes from outside
  const [prevSelected, setPrevSelected] = useState(selectedIndex);
  if (prevSelected !== selectedIndex) {
    setPrevSelected(selectedIndex);
    if (selectedIndex >= 0) setActive(selectedIndex);
  }

  const move = (i: number) => {
    const n = Math.max(0, Math.min(rows.length - 1, i));
    setActive(n);
    rowRefs.current[n]?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>, i: number) => {
    const row = rows[i];
    if (e.key === 'ArrowDown') move(i + 1);
    else if (e.key === 'ArrowUp') move(i - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(rows.length - 1);
    else if ((e.key === 'Enter' || e.key === ' ') && row) onSelect(row);
    else return;
    e.preventDefault();
  };

  const style = { ['--n-sources' as string]: String(sources.length) };

  return (
    <div ref={ref} role="grid" aria-label={copy.chart.label} aria-rowcount={rows.length + 1} className="bg-surface border border-line rounded-[var(--radius-row)]" data-testid="chart">
      <div role="rowgroup">
        <div role="row" className="chart-grid border-b border-line bg-surface-2 rounded-t-[var(--radius-row)]" style={style}>
          <div role="columnheader" className="px-3 py-2 text-small font-semibold text-ink-muted self-end">
            {copy.chart.medicine}
          </div>
          {sources.map((s, i) => (
            <div role="columnheader" key={s.id} className="px-3 py-2 min-w-0" data-testid={`source-head-${s.id}`}>
              <SourceChip sourceId={s.id} index={i} label={s.label} className="text-small" />
              <span className="block text-small text-ink-muted tabular-nums mt-0.5">{copy.chart.asOf(showTime(s.asOf))}</span>
            </div>
          ))}
          <div role="columnheader" className="px-3 py-2 text-small font-semibold text-ink-muted self-end">
            {copy.chart.status}
          </div>
        </div>
      </div>
      <div role="rowgroup">
        {rows.map((row, i) => {
          const seam = seamState(row.rowState);
          const selected = row.drugKey === selectedDrugKey;
          return (
            <div
              key={row.drugKey}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              role="row"
              aria-selected={selected}
              aria-label={rowAccessibleName(row)}
              aria-rowindex={i + 2}
              tabIndex={i === activeIndex ? 0 : -1}
              data-testid={`row-${row.drugKey}`}
              data-focus-id={`row-${row.drugKey}`}
              data-state={row.rowState}
              onKeyDown={(e) => onKey(e, i)}
              onClick={() => {
                setActive(i);
                if (row.conflicts.length) onSelect(row);
              }}
              onFocus={() => setActive(i)}
              className={cn(
                'chart-grid relative min-h-16 border-b border-line last:border-b-0 outline-none',
                row.conflicts.length ? 'cursor-pointer hover:bg-surface-2' : '',
                'focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2',
                selected && 'bg-surface-2 shadow-[inset_3px_0_0_var(--violet)]',
              )}
              style={style}
            >
              <div role="gridcell" className={cn('px-3 py-3 text-body font-semibold text-ink wrap-anywhere', row.rowState === 'superseded' && 'line-through text-ink-muted')}>
                {row.displayName}
              </div>
              {row.cells.map((cell, ci) => (
                <div role="gridcell" key={cell.sourceId} className="px-3 py-3 min-w-0" data-testid={`cell-${row.drugKey}-${cell.sourceId}`}>
                  <CellValue cell={cell} index={ci} unreadableLink={openProblems && problemSources.has(cell.sourceId) ? openProblems : null} />
                </div>
              ))}
              <div role="gridcell" className="px-3 py-3">
                <RowPills row={row} />
              </div>
              {seam && (
                <SeamLine
                  state={seam}
                  className="absolute bottom-0"
                  style={{ gridColumn: '2 / -2', gridRow: '1', left: 0, right: 0, width: '100%' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

/** Narrow screens: one card per medicine with the source values stacked. Validates: review-ui 13.3 */
export function ChartCards({ rows, sources, selectedDrugKey, onSelect }: ChartProps) {
  return (
    <ul className="flex flex-col gap-3" aria-label={copy.chart.label} data-testid="chart-cards">
      {rows.map((row) => {
        const seam = seamState(row.rowState);
        const interactive = row.conflicts.length > 0;
        const body = (
          <>
            <span className="flex flex-wrap items-start justify-between gap-2">
              <span className={cn('text-body font-semibold text-ink wrap-anywhere', row.rowState === 'superseded' && 'line-through text-ink-muted')}>{row.displayName}</span>
              <RowPills row={row} />
            </span>
            <span className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-2 text-left">
              {row.cells.map((cell, ci) => (
                <span key={cell.sourceId} className="min-w-0">
                  <SourceChip sourceId={cell.sourceId} index={ci} label={sources[ci]?.label ?? cell.sourceId} className="text-small" />
                  {/* no nested button inside the card button; the problems panel is directly above the cards */}
                  <CellValue cell={cell} index={ci} unreadableLink={null} />
                </span>
              ))}
            </span>
            {seam && <SeamLine state={seam} className="mt-3" />}
          </>
        );
        return (
          <li key={row.drugKey}>
            {interactive ? (
              <button
                type="button"
                data-testid={`row-${row.drugKey}`}
                data-focus-id={`row-${row.drugKey}`}
                data-state={row.rowState}
                aria-label={rowAccessibleName(row)}
                aria-pressed={row.drugKey === selectedDrugKey}
                onClick={() => onSelect(row)}
                className={cn('w-full text-left block p-4 bg-surface border border-line rounded-[var(--radius-row)]', row.drugKey === selectedDrugKey && 'shadow-[inset_3px_0_0_var(--violet)]')}
              >
                {body}
              </button>
            ) : (
              <div data-testid={`row-${row.drugKey}`} data-state={row.rowState} className="block p-4 bg-surface border border-line rounded-[var(--radius-row)]">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
