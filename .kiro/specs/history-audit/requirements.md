# Requirements: history-audit

## Introduction
Record each signed-off reconciled list as a tamper-evident commit, and answer three questions about the record: what happened (log), what changed (diff), and who or what last changed each line and why (blame).

Read first: `docs/MERGE_SEMANTICS.md` sections 6 and 7, `data/vectors/canonical.json`, `data/scenarios/hero.json` (`priorCommits`, `demoCommit`, `expectedAfterDemoScript`).

## Requirements

### Requirement 1: Commit creation
**User Story:** As a pharmacist, I want to sign off a reconciled list with a message, so that the decision is on record.

#### Acceptance Criteria
1. IF `draft.canCommit` is false, THEN `commitDraft` SHALL return `UNRESOLVED_CONFLICTS` and SHALL NOT create a commit.
2. IF the trimmed message is empty or longer than 200 characters, THEN `commitDraft` SHALL return `MESSAGE_REQUIRED`.
3. WHEN the input is valid, THE function SHALL create a commit whose `entries` are the draft entries, whose `resolutions` are the draft's effective resolutions, whose `agreements` list each clean entry's drugKey and agreedBy, and whose `sourcesSeen` list each source's id and asOf, each sorted as in `docs/MERGE_SEMANTICS.md` section 6.
4. THE commit's `parentId` SHALL be the id of the parent commit, or null when there is no parent.
5. THE commit's `at` SHALL come from the injected clock and nowhere else.
6. THE function SHALL NOT mutate its inputs.

### Requirement 2: Canonical form and identifier
**User Story:** As an auditor, I want identical content to always give the same identifier, so that a record can be verified.

#### Acceptance Criteria
1. THE function `canonicalise` SHALL produce JSON text with object keys sorted ascending by UTF-16 code unit at every depth, no whitespace, array order preserved, and object properties whose value is `undefined` omitted.
2. THE function SHALL print numbers as `JSON.stringify` prints them and strings with `JSON.stringify` escaping, and SHALL NOT escape non-ASCII characters.
3. IF a value is a non-finite number, a function, a symbol, a bigint, an `undefined` inside an array, or any other type that is not null, boolean, finite number, string, array or plain object, THEN `canonicalise` SHALL return the error `CANONICAL_INVALID`.
4. THE function SHALL produce exactly the `canonical` text of every vector in `data/vectors/canonical.json`.
5. THE function `sha256Hex` SHALL return the lower-case hexadecimal SHA-256 of the UTF-8 bytes of its input, and SHALL match every `sha256` vector in `data/vectors/canonical.json`.
6. THE commit `id` SHALL equal `sha256Hex` of the canonical text of the commit without its `id` field.

### Requirement 3: Chain verification
**User Story:** As an auditor, I want to detect any change to the history.

#### Acceptance Criteria
1. THE function `verifyChain` SHALL return success for an empty history and for a history in which the first commit has a null `parentId`, each later commit's `parentId` equals the previous commit's `id`, and every commit's `id` equals the identifier recomputed from its content.
2. IF any condition in 1 fails, THEN `verifyChain` SHALL return `CHAIN_BROKEN` with the index of the first commit that fails.
3. WHEN any field of any commit is changed after creation, THE function SHALL report `CHAIN_BROKEN` at that commit's index.

### Requirement 4: Log
**User Story:** As a reviewer, I want a readable list of past sign-offs.

#### Acceptance Criteria
1. THE function `log` SHALL return one line per commit, newest first, with id, message, author, time, entry count and resolution count.
2. THE function SHALL NOT change the order or content of the history it reads.

### Requirement 5: Diff
**User Story:** As a reviewer, I want to see what a sign-off changed.

#### Acceptance Criteria
1. THE function `diffCommits` SHALL list as `added` the drugKeys present in the commit and absent from the parent, as `removed` those present in the parent and absent from the commit, each sorted.
2. THE function SHALL list as `changed` one item per differing field (strength, frequency or status) of a drugKey present in both, with the value strings before and after, sorted by drugKey then field in the order strength, frequency, status.
3. WHEN the parent is null, THE function SHALL treat the parent as an empty list.
4. THE diff of a commit against itself SHALL be empty.
5. FOR ALL parent and commit pairs, applying the diff to the parent's value strings SHALL give the commit's value strings.

### Requirement 6: Blame
**User Story:** As an auditor, I want to know when each line last changed and when a person last decided it.

#### Acceptance Criteria
1. THE function `blame` SHALL return one line per entry of the head commit, sorted by drugKey.
2. THE blamed commit of a line SHALL be the oldest commit of the unbroken run, ending at the head, in which the drugKey has identical strength, frequency and status.
3. THE `reasonCodes` of a line SHALL be the sorted unique reason codes of the blamed commit's effective resolutions for that drugKey, excluding escalations, or empty if the blamed commit has none.
4. THE `lastDecision` of a line SHALL be the newest commit (searching from the head backwards) that has an effective resolution for that drugKey, with that commit's reason codes for the drugKey (escalations excluded), or null if none.
5. WHEN given `hero.json` after the demo commit, THE function SHALL produce the blamed commits, reason codes and last decisions in `expectedAfterDemoScript.blame` (commit indexes 0, 1, 2 map to the history order).

### Requirement 7: Replay of prior commits
**User Story:** As a user opening a scenario, I want its earlier history to be present, so that the demo shows a real log.

#### Acceptance Criteria
1. THE function `replayPriorCommits` SHALL turn each prior commit's raw items into a commit by normalising them as one list, with empty `resolutions`, `agreements` listing each drugKey with an empty `agreedBy`, empty `sourcesSeen`, the stated message, author and time, and the previous replayed commit as parent.
2. THE function SHALL produce the same ids on every run.
3. WHEN given `hero.json`, THE function SHALL produce two commits whose entries' value strings equal the normalised prior items, and the second commit's entries SHALL equal the base used by `expected.clean` and `expected.removedVsBase`.

### Requirement 8: Immutability
**User Story:** As an auditor, I want history only ever extended.

#### Acceptance Criteria
1. THE history functions SHALL NOT modify any commit object passed to them.
2. WHEN a commit is appended to a history, THE earlier commits SHALL remain deeply equal to before.
