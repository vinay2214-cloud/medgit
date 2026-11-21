/**
 * Injected clock. Core never reads the system time; the UI supplies a clock
 * that does (src/ui/state/clock.ts).
 */

export interface Clock {
  /** ISO 8601 UTC timestamp. */
  now(): string;
}

export function fixedClock(iso: string): Clock {
  return { now: () => iso };
}
