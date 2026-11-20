/**
 * Fast-check configuration helper.
 * Reads FC_NUM_RUNS from environment, defaults to 100.
 */
export function runs(): number {
  return Number(process.env.FC_NUM_RUNS ?? 100);
}
