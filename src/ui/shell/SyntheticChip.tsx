/**
 * "Synthetic data" chip - always visible at every viewport width.
 * Uses notice.synthetic from the copy deck.
 */

export function SyntheticChip() {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 text-small bg-surface-2 text-ink-muted rounded-[var(--radius-pill)]"
      aria-label="Data notice"
    >
      Synthetic data
    </span>
  );
}
