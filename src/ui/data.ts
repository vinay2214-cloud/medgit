/**
 * Bundled demo data. Imported at build time (resolveJsonModule), never fetched.
 */
import formularyJson from '../../data/formulary.json';
import heroJson from '../../data/scenarios/hero.json';
import cleanJson from '../../data/scenarios/clean.json';
import messyJson from '../../data/scenarios/messy.json';
import { loadFormulary, type Decision, type Formulary, type PriorCommit, type RawSourceList, type ReasonCode, type Role } from '@core';

export interface Scenario {
  id: string;
  title: string;
  blurb: string;
  patient: { label: string; age: number; sex: string };
  syntheticNotice: string;
  sources: RawSourceList[];
  priorCommits: PriorCommit[];
  demoScript: { conflictId: string; role: Role; decision: Decision; reasonCode: ReasonCode; note: string }[];
  demoCommit?: { message: string; author: { role: Role; name?: string }; at: string };
}

const loaded = loadFormulary(formularyJson);
if (!loaded.ok) throw new Error(`Bundled formulary is invalid: ${loaded.error.message}`);
export const formulary: Formulary = loaded.value;

/** Hero, Clean, Messy, in that order. */
export const scenarios: Scenario[] = [heroJson, cleanJson, messyJson] as unknown as Scenario[];

export function scenarioById(id: string | null): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
