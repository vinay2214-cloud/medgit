# MedGit merge semantics

Source of truth for how lists are normalised, compared, resolved, committed and blamed. The specs in `.kiro/specs/` cite this file. If code and this file disagree, this file wins unless the human changes it.

## 1. Vocabulary

| Git idea | MedGit meaning | Label in the UI |
|---|---|---|
| branch | one source's medicine list (hospital, GP, pharmacy, patient) | Source list |
| merge | compare all source lists | Reconcile |
| conflict | the sources disagree about one medicine | Discrepancy (microcopy: "conflict") |
| conflict marker | text view of the claims | Marker view |
| resolution | a person's decision with a reason | Decision |
| commit | a signed-off reconciled list | Sign-off (microcopy: "commit") |
| log, diff, blame | history, changes, who last changed a line | History, Changes, Last changed |
| base | the previous reconciled list (parent commit) | Last reconciliation |

## 2. Types

```ts
type SourceId = string;                 // 'hospital' | 'gp' | 'pharmacy' | 'patient' in the demo
type DrugKey = string;                  // formulary id, or 'unmapped:<slug>'
type Role = 'clinician' | 'pharmacist';
type Status = 'active' | 'stopped' | 'on-hold';
type Unit = 'mg' | 'mcg' | 'ml' | 'iu';          // grams are converted to mg
interface Strength { values: number[]; unit: Unit }   // [800,160] for combinations
type Frequency = { kind: 'scheduled'; perDay: 1 | 2 | 3 | 4 } | { kind: 'prn' };
type IssueCode = 'UNMAPPED_DRUG' | 'UNPARSED_STRENGTH' | 'STRENGTH_NOT_IN_FORMULARY'
               | 'UNPARSED_FREQUENCY' | 'UNPARSED_STATUS' | 'DUPLICATE_DRUG';   // DUPLICATE_DRUG is blocking
type EntryFlag = Exclude<IssueCode, 'DUPLICATE_DRUG'>;

interface MedEntry {
  drugKey: DrugKey; displayName: string;
  strength: Strength | null; frequency: Frequency | null; status: Status;
  flags: EntryFlag[];                    // sorted; derived, never compared
}

interface RawItem { name: string; form?: string; strength?: string; frequency?: string; status?: string; note?: string }
interface RawSourceList { id: SourceId; label: string; kind: 'prescriber' | 'dispenser' | 'patient'; asOf: string; items: RawItem[] }
interface SourceList { id: SourceId; label: string; kind: RawSourceList['kind']; asOf: string;
                       entries: MedEntry[];   // sorted by drugKey, drugKeys unique
                       valid: boolean }       // false if a blocking issue exists

type ConflictKind = 'OMISSION' | 'DOSE' | 'FREQUENCY' | 'STATUS';
type ConflictId = `${DrugKey}::${ConflictKind}`;
interface Claim { source: SourceId; entry: MedEntry | null }   // null only for OMISSION: "not listed"
interface Conflict { id: ConflictId; drugKey: DrugKey; kind: ConflictKind; claims: Claim[] }
interface CleanEntry { entry: MedEntry; agreedBy: SourceId[]; changeVsBase: 'added' | 'changed' | 'unchanged' | null }
interface MergeResult {
  baseCommitId: string | null;
  sources: { id: SourceId; label: string; kind: string; asOf: string }[];  // sorted by id
  clean: CleanEntry[];                  // sorted by drugKey
  conflicts: Conflict[];                // sorted by drugKey, then kind order
  removedVsBase: DrugKey[];             // in base, listed by no source
}

type ReasonCode = 'VERIFIED_WITH_PRESCRIBER' | 'CONFIRMED_WITH_PATIENT' | 'PER_DISPENSING_RECORD'
                | 'PER_DISCHARGE_SUMMARY' | 'CLINICAL_JUDGEMENT' | 'NEEDS_PHARMACIST_REVIEW';
type Decision = { type: 'include' } | { type: 'exclude' }                  // OMISSION only
              | { type: 'choose'; source: SourceId }                         // field conflicts only
              | { type: 'custom'; value: Strength | Frequency | Status }     // field conflicts only
              | { type: 'escalate' };                                        // any conflict
interface Resolution { seq: number; conflictId: ConflictId; decision: Decision; reasonCode: ReasonCode;
                       note?: string; by: { role: Role; name?: string }; at: string }
type ConflictState = 'open' | 'escalated' | 'resolved' | 'superseded';

interface Draft {
  states: Record<ConflictId, ConflictState>;
  entries: MedEntry[];                  // fully decided drugs only, sorted by drugKey
  excluded: DrugKey[];                  // drugs a person chose to leave off
  pendingDrugKeys: DrugKey[];           // drugs with at least one open or escalated conflict
  pendingCount: number;                 // conflicts in state open or escalated
  canCommit: boolean;
  effective: (Resolution & { manual: boolean })[];   // latest per conflict, sorted by conflictId
}

interface Commit {
  id: string; parentId: string | null; message: string; author: { role: Role; name?: string }; at: string;
  entries: MedEntry[];
  resolutions: (Resolution & { manual: boolean })[];
  agreements: { drugKey: DrugKey; agreedBy: SourceId[] }[];
  sourcesSeen: { id: SourceId; asOf: string }[];
}

interface LogLine { id: string; message: string; author: Commit['author']; at: string; entryCount: number; resolutionCount: number }
interface CommitDiff {
  added: DrugKey[]; removed: DrugKey[];
  changed: { drugKey: DrugKey; field: 'strength' | 'frequency' | 'status'; from: string; to: string }[];  // values as display strings
}
interface BlameLine { drugKey: DrugKey; blamedCommitId: string; reasonCodes: ReasonCode[];
                      lastDecision: { commitId: string; reasonCodes: ReasonCode[] } | null }
```

Field values are compared structurally. `displayName`, `flags` and notes are never compared. Two `null`s are equal; `null` never equals a value.

## 3. Merge (N-way, unanimity rule)

Input: two or more valid `SourceList`s with unique ids, and an optional base commit.

```
ids  = source ids sorted ascending
keys = union of drugKeys, sorted ascending
for k in keys:
  listing = ids that list k
  found = []
  if len(listing) < len(ids):
      found.push(OMISSION with a claim for EVERY id; entry = null where the source does not list k)
  for (kind, field) in [(DOSE, strength), (FREQUENCY, frequency), (STATUS, status)]:
      if the listing sources hold more than one distinct value of field:
          found.push(kind conflict with a claim for each LISTING source only)
  if found is empty: clean.push({ entry, agreedBy: ids, changeVsBase })
  else: conflicts.push(...found)       // drug is NOT in clean
```

Rules that follow from this:
- Unanimity is the only way to be clean. Absence counts as disagreement.
- A drug can have several conflicts (for example OMISSION and DOSE). Each is separate and has its own id.
- No rule chooses between values: not recency, not source kind, not majority.
- `changeVsBase` (only when a base commit is given): compare the clean entry with the base entry of the same drugKey. Missing in base is `added`. Equal values is `unchanged`. Anything else is `changed`. Without a base it is `null`.
- `removedVsBase`: base drugKeys that no source lists. Shown as information. The base never changes which conflicts appear.
- A clean or drafted entry is built from the first listing source by id (its `displayName`), with `flags` set to the sorted union of the flags of all listing sources. Compared fields are equal across them by construction.
- Output is canonical: the same result for any ordering of the input sources.

Errors: `TOO_FEW_SOURCES`, `DUPLICATE_SOURCE_ID`, `INVALID_SOURCE` (a source with a blocking normaliser issue).

## 4. Resolution

A resolution is an event. Events are appended in order and numbered (`seq`). The effective resolution of a conflict is its latest valid event.

| Decision | Allowed on | Meaning | Validation |
|---|---|---|---|
| `include` | OMISSION | the drug belongs on the reconciled list | none |
| `exclude` | OMISSION | leave the drug off | none |
| `choose{source}` | DOSE, FREQUENCY, STATUS | accept that source's value | source must be a claimant, else `NOT_A_CLAIMANT` |
| `custom{value}` | DOSE, FREQUENCY, STATUS | a person types a new value | value must match the field type, else `INVALID_DECISION`; result is marked `manual` |
| `escalate` | any | ask a pharmacist | reason code must be `NEEDS_PHARMACIST_REVIEW` |

Every decision needs a `reasonCode` (else `REASON_REQUIRED`). `NEEDS_PHARMACIST_REVIEW` is valid only with `escalate`. `note` is optional, at most 280 characters.

Authorisation: a conflict whose effective decision is `escalate` can only receive a non-escalate decision from role `pharmacist` (else `NOT_AUTHORISED`). A clinician may escalate any conflict. A pharmacist may decide any conflict.

State of a conflict:

```
open       --escalate--> escalated
open       --include/exclude/choose/custom--> resolved
escalated  --(pharmacist) include/exclude/choose/custom--> resolved
resolved   --any valid new decision--> resolved | escalated      (re-deciding is allowed)
any        --OMISSION exclude on the same drug--> superseded     (field conflicts of an excluded drug)
```

Supersession: when the effective decision on a drug's OMISSION conflict is `exclude`, every field conflict of that drug becomes `superseded` (no decision needed) and the drug is left off.

## 5. Draft and commit gating

`applyResolutions(merge, resolutions)` returns a `Draft`.
- `states`: as above. No resolution means `open`.
- `pendingCount`: number of `open` plus `escalated` conflicts.
- `canCommit` is true if and only if every conflict is `resolved` or `superseded`.
- A drug appears in `entries` only when it is fully decided:
  - clean drug: its clean entry;
  - drug with an OMISSION conflict: needs the OMISSION decided. `exclude` leaves it off. `include` needs every field conflict of the drug decided too;
  - drug with only field conflicts: needs each of them decided.
- Field values of an included drug: for a field with a resolved conflict, the resolved value (`choose` takes the chosen source's value, `custom` takes the typed value). For a field without a conflict, the single value all listing sources share.
- `effective` lists the latest event per conflict, sorted by `conflictId`, with `manual = decision.type === 'custom'`.

## 6. Commit, canonical JSON, hashing

`commitDraft` requires `canCommit` (else `UNRESOLVED_CONFLICTS`), a non-empty message of at most 200 characters, and an author role. Time comes from the injected `Clock`.

- `entries` come from the draft, `resolutions` from `draft.effective`, `agreements` from `merge.clean` (drugKey and agreedBy), `sourcesSeen` from the merge sources (id and asOf), sorted by id.
- `id` is the lower-case hex SHA-256 of the canonical JSON of the commit without its `id` field.
- Canonical JSON: object keys sorted ascending by UTF-16 code unit at every depth, no whitespace, array order preserved, `undefined` properties omitted, numbers as `JSON.stringify` prints them, no `NaN` or infinities (reject). Strings UTF-8 encoded before hashing.
- The UI shows the first 7 characters of an id.

## 7. History, diff, blame

- History is an array from root to head. `parentId` of each commit is the previous commit's id (root is `null`). Appending never changes earlier commits.
- `verifyChain` recomputes every id and checks every parent link. First failure gives `CHAIN_BROKEN` with the index.
- `log(history)`: head to root, each with id, message, author, at, `entries.length`, `resolutions.length`.
- `diffCommits(parent, commit)`: `added` and `removed` drugKeys, and `changed` as `{drugKey, field: 'strength' | 'frequency' | 'status', from, to}`. A root commit diffs against an empty list.
- `blame(history)` returns one `BlameLine` per entry of the head commit, sorted by drugKey:
  `{ drugKey, blamedCommitId, reasonCodes: ReasonCode[], lastDecision: { commitId, reasonCodes } | null }`.
  - `blamedCommitId`: walk back from the head while the parent commit holds an entry with the same drugKey and identical values; the oldest commit of that unbroken run is blamed. This answers "when did this line last change".
  - `reasonCodes`: reason codes of the blamed commit's effective resolutions whose conflict has that drugKey (sorted, unique, escalations excluded). Empty means no decision was needed for that change.
  - `lastDecision`: the newest commit (head first, walking back) that has an effective resolution for that drugKey, with its reason codes. `null` if no commit ever recorded a decision for it. This answers "when did a person last decide this", even when the value did not change (metformin in the hero scenario).
  - Golden values for the hero scenario are in `expectedAfterDemoScript.blame` (commit indexes: 0 and 1 are the prior commits, 2 is the new commit).
- `replayPriorCommits(priorCommits, formulary)`: for each prior commit in order, normalise its items, build entries (all sources treated as agreed), commit with the stated author and time, no resolutions, parent chained. Ids are deterministic.

## 8. Worked example: the hero scenario

Normalised values (strength, frequency, status). "-" means not listed.

| Medicine | hospital | gp | pharmacy | patient | Result |
|---|---|---|---|---|---|
| Atorvastatin | 20 mg, 1/day, active | same | same | same | agreed by all 4 |
| Levothyroxine | 50 mcg, 1/day | same | same (0.05 mg) | same | agreed by all 4 |
| Pantoprazole | 40 mg, 1/day | same | same | same | agreed, added vs base |
| Metformin | 500 mg, 2/day | 500 mg, 2/day | 500 mg, 2/day | 500 mg, **1/day** | `metformin-tab::FREQUENCY` |
| Amlodipine | 5 mg | 5 mg | **10 mg** | 5 mg | `amlodipine-tab::DOSE` |
| Aspirin | active | **stopped** | active | active | `aspirin-tab::STATUS` |
| Paracetamol | 500 mg | 500 mg | 500 mg | **650 mg** | `paracetamol-tab::DOSE` |
| Cotrimoxazole | 800/160 mg, 2/day | - | - | - | `cotrimoxazole-tab::OMISSION` |
| Salbutamol inhaler | - | - | - | 100 mcg, prn | `salbutamol-inhaler::OMISSION` |

Six conflicts, three agreed. The `demoScript` in `data/scenarios/hero.json` resolves all six (amlodipine is escalated by the clinician, then decided by the pharmacist). `demoCommit` gives the sign-off message, author and time. The result is a nine-line reconciled list. `expectedAfterDemoScript` in the same file holds the golden entries, diff against the head prior commit, and blame. Golden tests do not assert commit ids for scenario commits; they assert that each id equals the SHA-256 of the canonical JSON recomputed independently, and they assert fixed vectors in `data/vectors/canonical.json`.

## 9. Error codes

| Code | Raised by |
|---|---|
| `TOO_FEW_SOURCES`, `DUPLICATE_SOURCE_ID`, `INVALID_SOURCE` | merge |
| `NOT_A_CLAIMANT`, `REASON_REQUIRED`, `NOT_AUTHORISED`, `INVALID_DECISION` | resolution validation |
| `UNRESOLVED_CONFLICTS`, `MESSAGE_REQUIRED` (empty or over 200 characters) | commit |
| `CANONICAL_INVALID` | canonicalise, commit |
| `CHAIN_BROKEN` | verifyChain |
| `CASEFILE_INVALID` | case file import |

## 10. Decisions and edge cases

- **Why unanimity, not a three-way merge against the base?** Medication reconciliation is about every list agreeing. A medicine one source never heard of is a discrepancy, not a clean addition. The base is used to label what changed and to build history, so the git workflow (branches, conflicts, commits, blame) is real without auto-applying anything.
- **Why a dispenser or patient list can never win automatically.** Nothing wins automatically. People choose.
- **Duplicate drug inside one source** is a blocking normaliser issue; the list is marked invalid and merge refuses it. Fixing the source is out of scope for v1.
- **Unmapped drugs** merge by slug. The same herbal remedy written two ways with the same words becomes one key.
- **Strength on a combination product** compares the whole value list.
- **Escalating then re-deciding**: allowed. The log keeps every event; the commit keeps the effective one.
