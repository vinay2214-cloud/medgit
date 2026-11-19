# Design: merge-engine

## Overview
Three pure modules in `src/core`: `merge.ts` (classify), `resolve.ts` (validate decisions, compute the draft) and `markers.ts` (text markers). Types are in `src/core/types.ts` as in `docs/MERGE_SEMANTICS.md` section 2. The reference implementation `docs/reference/reference.py` has the merge; the resolution and draft rules are in `docs/MERGE_SEMANTICS.md` sections 4 and 5 and in the table-driven tests below.

## Module APIs
```ts
// merge.ts
mergeSources(sources: SourceList[], base: Commit | null): Result<MergeResult, MergeError>
type MergeError = { code: 'TOO_FEW_SOURCES' } | { code: 'DUPLICATE_SOURCE_ID'; id: string } | { code: 'INVALID_SOURCE'; id: string };

// resolve.ts
validateResolution(merge: MergeResult, existing: Resolution[], candidate: Omit<Resolution,'seq'>): Result<Resolution, ResolveError>
applyResolutions(merge: MergeResult, resolutions: Resolution[]): Draft
type ResolveError = { code: 'NOT_A_CLAIMANT' | 'REASON_REQUIRED' | 'NOT_AUTHORISED' | 'INVALID_DECISION'; message: string };
effectiveResolutions(resolutions: Resolution[]): Map<ConflictId, Resolution>    // helper, exported for tests

// markers.ts
renderMarkers(conflicts: Conflict[], sources: MergeResult['sources']): string
```

## Merge algorithm
Exactly the pseudocode in `docs/MERGE_SEMANTICS.md` section 3. Notes for implementation:
- Index entries per source with a `Map<DrugKey, MedEntry>`.
- `equalStrength(a, b)`: both null, or same unit and same `values.length` and every value strictly equal (values are already rounded to six decimals by the normaliser).
- `equalFrequency`: both null, or same kind and (for scheduled) same perDay.
- Build `clean` entries from the first listing source by id with flags unioned.
- `changeVsBase` compares against `base.entries` (strength, frequency and status only).
- Sort everything at the end (do not rely on iteration order). Sorting must use plain code unit comparison (`a < b ? -1 : a > b ? 1 : 0`), never `localeCompare`, so results are identical in every environment.

## Resolution validation (`validateResolution`)
Checks in this order, returning the first failure:
1. Conflict id exists in `merge.conflicts`, else `INVALID_DECISION`.
2. Reason code present, else `REASON_REQUIRED`.
3. Decision type allowed for the conflict kind, else `INVALID_DECISION`.
4. `escalate` requires reason `NEEDS_PHARMACIST_REVIEW`; any other decision must not use it; mismatch is `INVALID_DECISION`.
5. `choose.source` is a claimant (a claim with a non-null entry), else `NOT_A_CLAIMANT`.
6. `custom.value` passes `isValidCustomValue(kind, value)`: strength has a unit in mg, mcg, ml, iu, one or two finite positive values; frequency is `{kind:'scheduled', perDay: 1..4}` or `{kind:'prn'}`; status is one of active, stopped, on-hold. Else `INVALID_DECISION`.
7. Note length at most 280, else `INVALID_DECISION`.
8. Authorisation: `effective = effectiveResolutions(existing).get(conflictId)`; if `effective?.decision.type === 'escalate'`, `candidate.decision.type !== 'escalate'` and `candidate.by.role !== 'pharmacist'`, return `NOT_AUTHORISED`.
9. Success: `{ ...candidate, seq: maxSeq(existing) + 1 }`.

Re-deciding an escalated conflict with `escalate` again by anyone is allowed (it changes nothing materially and keeps the log honest).

## Draft algorithm (`applyResolutions`)
```
eff      = effectiveResolutions(resolutions)            // latest seq per conflictId; ignore ids not in merge
excluded = drugKeys k where eff[k::OMISSION]?.decision.type === 'exclude'
for c in merge.conflicts:
    if c.kind !== 'OMISSION' and c.drugKey in excluded: state = 'superseded'
    else d = eff[c.id]: none -> 'open'; escalate -> 'escalated'; else 'resolved'
entries = merge.clean entries
for each drugKey k that has conflicts and is not excluded:
    if any of k's conflicts is open or escalated: pendingDrugKeys.push(k); continue
    template = first listing source's entry (by source id) among the claims of k's conflicts with non-null entries
    strength  = decided value if k has a resolved DOSE conflict else the shared value
    frequency = decided value if k has a resolved FREQUENCY conflict else the shared value
    status    = decided value if k has a resolved STATUS conflict else the shared value
    entries.push(...)
sort entries by drugKey; sort pendingDrugKeys; excluded sorted
pendingCount = number of conflicts in open or escalated
canCommit    = pendingCount === 0
effective    = latest resolution per conflict, sorted by conflictId, manual = decision.type === 'custom'
```
The "shared value" of a field without conflict is the value held by every listing source; read it from any listing source's entry. To find listing sources for a drug with only an OMISSION conflict, use the OMISSION claims with non-null entries.
Value of a decision: `choose` takes `claims.find(source).entry[field]`; `custom` takes `decision.value`.

## Markers (`renderMarkers`)
Output exactly as in `docs/UX_SPEC.md` section 5.7. Header line per conflict: `<drugKey>  <KIND>`. Groups ordered by the first source id in each group. Values use the value-string forms from the normaliser (`500 mg`, `2/day`, `prn`, `stopped`). OMISSION: listing sources show `listed: <strength>, <frequency>, <status>`; omitting sources group under `(not listed)`. Pure; ends with a trailing newline; blocks separated by one blank line.

## Error handling
All failures are `Result` errors. No exceptions for expected cases. `applyResolutions` is total: it ignores resolutions for unknown conflicts and never throws.

## Correctness properties (fast-check)
Generators in `tests/helpers/gen.ts` (extend the normaliser file): `genSourceLists({minSources:2, maxSources:4})` builds sources from ids `hospital, gp, pharmacy, patient`, drugKeys from five formulary ids, strengths from three values, frequencies from `1/day, 2/day, prn`, statuses `active, stopped`, with each source omitting each drug with probability 0.3. `genBase` makes a random commit over the same universe. `genValidDecision(conflict, role)`.

- **P-M1 Coverage.** Every drugKey that appears in any source appears in `clean` or in at least one conflict, never in neither; no drugKey appears in both. Validates: merge-engine 2.6, 9.2.
- **P-M2 No invention.** For any sources and any valid sequence of resolutions, every field value of every draft entry equals a value held by a claim of that drug or a `custom` value that was typed. With no resolutions, `draft.entries` equals the clean entries. Validates: merge-engine 8.3, 8.7, 9.1, 9.3.
- **P-M3 Order independence.** Any permutation of the sources gives a deeply equal `MergeResult`. Validates: merge-engine 4.1, 4.2.
- **P-M4 Unanimity.** If every source has the same entries (same drugKeys and equal fields), there are no conflicts and `clean` has all drugs. If sources differ in any compared field or in membership for some drug, that drug is not clean. Validates: merge-engine 2.1, 2.2, 2.3, 4.4.
- **P-M5 Base independence.** Conflicts are deeply equal for base null, base A and base B. Validates: merge-engine 5.4.
- **P-M6 Base labelling.** `changeVsBase` and `removedVsBase` match a direct recomputation from the base. Validates: merge-engine 5.1, 5.2, 5.3.
- **P-M7 Gate.** `canCommit` is true if and only if no conflict is open or escalated. Applying one valid decision per conflict (by a pharmacist) always gives `canCommit` true. A clinician's non-escalate decision on a conflict whose effective decision is escalate is rejected with `NOT_AUTHORISED`; a pharmacist's is accepted. Validates: merge-engine 7.2, 7.3, 8.4.
- **P-M8 Latest wins.** For any sequence of decisions on one conflict, the draft reflects the one with the highest `seq`. Validates: merge-engine 8.8.
- **P-M9 Markers round trip of facts.** For any merge result, `renderMarkers` contains each conflict id and, for each claim, the source id and the formatted value; calling it twice gives identical text. Validates: merge-engine 3.1 to 3.4 (presentation of claims).

## Golden and table tests
- `tests/golden/merge.test.ts`: for each scenario, normalise sources with the real normaliser, merge with the base from the last prior commit (replayed with the history module once it exists; until then build a minimal `Commit` object by hand from the normalised prior items), and compare to `expected`.
- `tests/golden/hero-demo.test.ts`: apply each `demoScript` step in order with fixed `at` values and the step's role and reason, expecting success for every step; assert the draft equals `expectedAfterDemoScript.entries` as value strings, `canCommit` is true, and `effective.length` equals 6. Validates: merge-engine 9.4.
- Table tests for every row of the decision table in `docs/MERGE_SEMANTICS.md` section 4 and every error code.

## Testing strategy
Properties first for classification and gating (they find edge cases cheaply); golden tests for the hero story; table tests for validation. When a property fails, read the counterexample, decide whether the code or the generator is wrong, and fix that. Never weaken a property.
