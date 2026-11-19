# Requirements: merge-engine

## Introduction
Compare any number of normalised source lists, report every disagreement as a conflict, accept validated human decisions, and compute the working draft. The engine never chooses a value for a person.

Read first: `.kiro/steering/clinical-safety.md`, `docs/MERGE_SEMANTICS.md` (all of it; it is the semantics source), `data/scenarios/hero.json` (`expected` and `demoScript`). The oracle for merge results is `python3 docs/reference/reference.py --check`.

Terms: **claim**, **conflict**, **clean entry**, **draft**, **effective resolution**, **base** are defined in `docs/MERGE_SEMANTICS.md`.

## Requirements

### Requirement 1: Merge input validation
**User Story:** As a developer, I want bad input rejected clearly, so that a merge never runs on data it cannot trust.

#### Acceptance Criteria
1. IF fewer than two source lists are given, THEN `mergeSources` SHALL return the error `TOO_FEW_SOURCES`.
2. IF two source lists have the same id, THEN `mergeSources` SHALL return `DUPLICATE_SOURCE_ID` naming the id.
3. IF any source list has `valid` false, THEN `mergeSources` SHALL return `INVALID_SOURCE` naming the source.
4. WHEN input is valid, THE function SHALL return a `MergeResult` and SHALL NOT mutate its inputs.

### Requirement 2: Unanimity classification
**User Story:** As a pharmacist, I want a medicine treated as settled only when every source agrees, so that nothing slips through.

#### Acceptance Criteria
1. THE engine SHALL place a medicine in `clean` if and only if every source lists it and all sources hold equal strength, frequency and status.
2. WHEN a source does not list a medicine that another source lists, THE engine SHALL treat this as a disagreement about that medicine.
3. THE engine SHALL compare strengths as equal only when their unit and every value are equal, and SHALL treat two null values as equal and a null and a non-null value as different.
4. THE engine SHALL NOT use recency, source kind, majority or any other rule to prefer one source's value.
5. THE engine SHALL NOT compare display names, flags or notes.
6. THE engine SHALL place every medicine from every source in exactly one place: `clean`, or at least one conflict (it never drops a medicine).

### Requirement 3: Conflicts
**User Story:** As a pharmacist, I want each kind of disagreement reported separately with every source's claim.

#### Acceptance Criteria
1. WHEN at least one source omits a medicine that another lists, THE engine SHALL create an OMISSION conflict with id `<drugKey>::OMISSION` and one claim per source, where the claim's entry is null for each source that omits it.
2. WHEN the sources that list a medicine hold more than one distinct strength, THE engine SHALL create a DOSE conflict with one claim per listing source.
3. WHEN the sources that list a medicine hold more than one distinct frequency, THE engine SHALL create a FREQUENCY conflict with one claim per listing source.
4. WHEN the sources that list a medicine hold more than one distinct status, THE engine SHALL create a STATUS conflict with one claim per listing source.
5. THE engine SHALL create every conflict that applies to a medicine; one medicine may have several conflicts, each with its own id.
6. THE engine SHALL order conflicts by drugKey ascending and then by kind in the order OMISSION, DOSE, FREQUENCY, STATUS.

### Requirement 4: Determinism
**User Story:** As a developer, I want the same inputs to give the same output, so that results can be tested and hashed.

#### Acceptance Criteria
1. THE engine SHALL return an equal `MergeResult` for any ordering of the input source lists.
2. THE engine SHALL order `sources` by id, `clean` by drugKey, and each entry's `agreedBy` by source id.
3. THE engine SHALL NOT read the clock, random numbers or any global state.
4. WHEN the same source list is supplied under several ids, THE engine SHALL report no conflicts for it.

### Requirement 5: Base commit
**User Story:** As a reviewer, I want to see what changed since the last reconciliation, without the base deciding anything.

#### Acceptance Criteria
1. WHEN a base commit is given, THE engine SHALL set `changeVsBase` on each clean entry to `added` if the base has no entry for that medicine, `unchanged` if the base entry has equal strength, frequency and status, and `changed` otherwise.
2. WHEN no base commit is given, THE engine SHALL set `changeVsBase` to null on every clean entry and `removedVsBase` to an empty list.
3. WHEN a base commit is given, THE engine SHALL set `removedVsBase` to the medicines in the base that no source lists, sorted by drugKey.
4. THE set of conflicts SHALL be identical with and without a base commit, and for any base commit.

### Requirement 6: Resolution validation
**User Story:** As a pharmacist, I want every decision checked, so that the record only holds valid, reasoned choices.

#### Acceptance Criteria
1. THE function `validateResolution` SHALL accept `include` and `exclude` only for an OMISSION conflict, and `choose` and `custom` only for DOSE, FREQUENCY and STATUS conflicts; otherwise it SHALL return `INVALID_DECISION`.
2. IF a `choose` decision names a source that has no claim on the conflict, THEN it SHALL return `NOT_A_CLAIMANT`.
3. IF a `custom` value does not have the type of the conflict's field (a strength with a unit and positive values, a frequency, or a status), THEN it SHALL return `INVALID_DECISION`.
4. IF the reason code is missing, THEN it SHALL return `REASON_REQUIRED`.
5. THE reason code `NEEDS_PHARMACIST_REVIEW` SHALL be valid only with `escalate`, and `escalate` SHALL require it.
6. IF the note is longer than 280 characters, THEN it SHALL return `INVALID_DECISION`.
7. IF the conflict id does not exist in the merge result, THEN it SHALL return `INVALID_DECISION`.
8. WHEN a decision is valid, THE function SHALL return the resolution with `seq` equal to one more than the highest `seq` among the existing resolutions (1 if none).

### Requirement 7: Escalation and authorisation
**User Story:** As a pharmacist, I want escalated items to need a pharmacist, so that the gate is real.

#### Acceptance Criteria
1. THE engine SHALL allow a clinician or a pharmacist to record `escalate` on any conflict.
2. WHILE the effective decision of a conflict is `escalate`, THE engine SHALL reject any other decision by a clinician with `NOT_AUTHORISED`.
3. WHILE the effective decision of a conflict is `escalate`, THE engine SHALL accept a valid decision by a pharmacist.
4. THE engine SHALL allow a clinician or a pharmacist to re-decide a conflict whose effective decision is not `escalate`.
5. THE enforcement SHALL be in the core function, not only in the interface.

### Requirement 8: Draft
**User Story:** As a user, I want a live draft of the reconciled list that shows only what has been decided.

#### Acceptance Criteria
1. THE function `applyResolutions` SHALL compute the state of each conflict as `open` (no resolution), `escalated` (effective decision is escalate), `resolved` (effective decision is any other valid decision) or `superseded` (the effective decision on the same medicine's OMISSION conflict is `exclude`).
2. THE draft SHALL include a medicine in `entries` only when it is fully decided as defined in `docs/MERGE_SEMANTICS.md` section 5, and SHALL list the other medicines in `pendingDrugKeys`.
3. THE value of each field of an included medicine SHALL be the chosen source's value, or the typed value for `custom`, or, where the field has no conflict, the value all listing sources share.
4. THE draft SHALL set `pendingCount` to the number of conflicts in state `open` or `escalated`, and `canCommit` to true if and only if every conflict is `resolved` or `superseded`.
5. THE draft SHALL list in `excluded` the medicines whose OMISSION decision is `exclude`.
6. THE draft SHALL list in `effective` the latest resolution of each conflict sorted by conflict id, with `manual` true exactly when the decision type is `custom`.
7. WHEN there are no resolutions, THE draft SHALL contain exactly the clean entries and SHALL have `pendingCount` equal to the number of conflicts.
8. WHEN a conflict is decided again, THE draft SHALL use the latest resolution (highest `seq`) and ignore earlier ones for that conflict.

### Requirement 9: Safety guarantees
**User Story:** As a clinical safety reviewer, I want the guarantees stated and tested, so that the product cannot quietly mislead.

#### Acceptance Criteria
1. THE engine SHALL NOT produce a draft entry whose strength, frequency or status was not held by some source for that medicine or typed by a person in a `custom` decision.
2. THE engine SHALL NOT remove a medicine from the result of a merge without an `exclude` decision by a person.
3. THE engine SHALL NOT resolve any conflict without an explicit resolution event.
4. WHEN given `hero.json` and its `demoScript` (with each step's role and reason), THE engine SHALL reach `canCommit` true with exactly the entries in `expectedAfterDemoScript.entries`.
5. WHEN given each scenario in `data/scenarios`, THE merge SHALL equal the scenario's `expected.clean`, `expected.conflicts` and `expected.removedVsBase`.
