/**
 * Test data helpers: the real formulary and scenarios, loaded through the core loader.
 */
import formularyJson from '../../data/formulary.json';
import hero from '../../data/scenarios/hero.json';
import clean from '../../data/scenarios/clean.json';
import messy from '../../data/scenarios/messy.json';
import {
  applyResolutions,
  commitDraft,
  fixedClock,
  loadFormulary,
  mergeSources,
  normaliseSourceList,
  replayPriorCommits,
  validateResolution,
  type Commit,
  type Decision,
  type Formulary,
  type MergeResult,
  type PriorCommit,
  type RawSourceList,
  type ReasonCode,
  type Resolution,
  type Role,
  type SourceList,
} from '@core';

const loaded = loadFormulary(formularyJson);
if (!loaded.ok) throw new Error(`formulary failed to load: ${loaded.error.message}`);
export const formulary: Formulary = loaded.value;

export interface DemoStep {
  conflictId: string;
  role: Role;
  decision: Decision;
  reasonCode: ReasonCode;
  note: string;
}

export interface Scenario {
  id: string;
  title: string;
  patient: { label: string; age: number; sex: string };
  syntheticNotice: string;
  sources: RawSourceList[];
  priorCommits: PriorCommit[];
  demoScript: DemoStep[];
  expected: {
    normalised: Record<string, Record<string, string>>;
    issues: Record<string, string[]>;
    clean: { drugKey: string; agreedBy: string[]; changeVsBase: string | null }[];
    conflicts: { id: string; kind: string; claims: Record<string, string | null> }[];
    removedVsBase: string[];
  };
  demoCommit?: { message: string; author: { role: Role; name?: string }; at: string };
  expectedAfterDemoScript?: {
    entries: Record<string, string>;
    diffVsHead: { added: string[]; removed: string[]; changed: { drugKey: string; field: string; from: string; to: string }[] };
    blame: Record<string, { blamedCommit: number; reasonCodes: string[]; lastDecision: { commit: number; reasonCodes: string[] } | null }>;
    counts: { entries: number; resolutionsEffective: number; conflictsTotal: number };
  };
}

export const scenarios: Scenario[] = [hero, clean, messy] as unknown as Scenario[];
export const heroScenario = hero as unknown as Scenario;

export function normalisedSources(sc: Scenario): SourceList[] {
  return sc.sources.map((s) => normaliseSourceList(s, formulary).list);
}

export function scenarioHistory(sc: Scenario): Commit[] {
  return replayPriorCommits(sc.priorCommits, formulary);
}

export function scenarioMerge(sc: Scenario): MergeResult {
  const history = scenarioHistory(sc);
  const r = mergeSources(normalisedSources(sc), history[history.length - 1] ?? null);
  if (!r.ok) throw new Error(`merge failed: ${r.error.code}`);
  return r.value;
}

/** Run the hero demo script through validateResolution; returns the merge, history and events. */
export function runHeroDemo(): { merge: MergeResult; history: Commit[]; resolutions: Resolution[] } {
  const history = scenarioHistory(heroScenario);
  const merge = scenarioMerge(heroScenario);
  const resolutions: Resolution[] = [];
  heroScenario.demoScript.forEach((step, i) => {
    const r = validateResolution(merge, resolutions, {
      conflictId: step.conflictId as Resolution['conflictId'],
      decision: step.decision,
      reasonCode: step.reasonCode,
      note: step.note,
      by: { role: step.role, name: step.role === 'pharmacist' ? 'Demo Pharmacist' : 'Demo Clinician' },
      at: `2026-11-20T09:${String(10 + i).padStart(2, '0')}:00Z`,
    });
    if (!r.ok) throw new Error(`demo step ${i} rejected: ${r.error.code}`);
    resolutions.push(r.value);
  });
  return { merge, history, resolutions };
}

/** The hero history after the demo commit (3 commits). */
export function heroAfterCommit(): { history: Commit[]; commit: Commit } {
  const { merge, history, resolutions } = runHeroDemo();
  const draft = applyResolutions(merge, resolutions);
  const dc = heroScenario.demoCommit;
  if (!dc) throw new Error('hero has no demoCommit');
  const c = commitDraft({ merge, draft, parent: history[history.length - 1] ?? null, message: dc.message, author: dc.author, clock: fixedClock(dc.at) });
  if (!c.ok) throw new Error(`commit failed: ${c.error.code}`);
  return { history: [...history, c.value], commit: c.value };
}
