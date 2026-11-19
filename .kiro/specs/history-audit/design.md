# Design: history-audit

## Overview
Two modules: `canonical.ts` (canonical JSON and SHA-256) and `history.ts` (commit, verify, log, diff, blame, replay). Pure. Time comes from an injected `Clock`.

## Module APIs
```ts
// canonical.ts
canonicalise(value: unknown): Result<string, { code: 'CANONICAL_INVALID'; path: string }>
sha256Hex(text: string): string                      // @noble/hashes/sha2.js + utils.js (bytesToHex), TextEncoder for UTF-8

// history.ts
commitDraft(input: { merge: MergeResult; draft: Draft; parent: Commit | null; message: string;
                     author: Commit['author']; clock: Clock }): Result<Commit, { code: 'UNRESOLVED_CONFLICTS' | 'MESSAGE_REQUIRED' | 'CANONICAL_INVALID' }>
commitId(commitWithoutId: Omit<Commit, 'id'>): string        // used by commitDraft and verifyChain
verifyChain(history: Commit[]): Result<true, { code: 'CHAIN_BROKEN'; index: number }>
log(history: Commit[]): LogLine[]
diffCommits(parent: Commit | null, commit: Commit): CommitDiff
blame(history: Commit[]): BlameLine[]
replayPriorCommits(prior: PriorCommit[], formulary: Formulary): Commit[]
interface PriorCommit { message: string; author: Commit['author']; at: string; items: RawItem[] }
```
Types `Commit`, `LogLine`, `CommitDiff`, `BlameLine` are in `docs/MERGE_SEMANTICS.md` section 2.

## Canonical JSON
Recursive function over `unknown`:
- `null`, `true`, `false`: literal text.
- number: must be finite; text is `JSON.stringify(n)` (note `-0` prints `0`, accept that).
- string: `JSON.stringify(s)`.
- array: `[` items joined by `,` `]`; an `undefined` item is an error.
- plain object (prototype is `Object.prototype` or null): keys from `Object.keys`, filter out `undefined` values, sort with the default string sort (UTF-16 code unit order), emit `"key":value` joined by `,`.
- anything else: `CANONICAL_INVALID` with a path like `entries[2].strength.values[0]`.
Use a manual recursive implementation, not `JSON.stringify` with a replacer, so the behaviour is explicit and testable. Tests load `data/vectors/canonical.json` and check text and hashes.

## Commit construction
```
if (!draft.canCommit) return err('UNRESOLVED_CONFLICTS')
message = input.message.trim(); if (message.length === 0 || message.length > 200) return err('MESSAGE_REQUIRED')
body = {
  parentId: parent?.id ?? null,
  message, author, at: clock.now(),
  entries: draft.entries,                                  // already sorted
  resolutions: draft.effective,                            // already sorted by conflictId
  agreements: merge.clean.map(c => ({ drugKey: c.entry.drugKey, agreedBy: c.agreedBy })),
  sourcesSeen: merge.sources.map(s => ({ id: s.id, asOf: s.asOf })),
}
id = commitId(body)                                        // sha256Hex(canonicalise(body))
return ok({ id, ...body })
```
Fields in the canonical body: `parentId, message, author, at, entries, resolutions, agreements, sourcesSeen`. The `id` is excluded when hashing. `author.name` is omitted when undefined. `resolutions[].note` is omitted when undefined.
Deep-copy inputs into the commit with a small `deepClone` helper in `canonical.ts` (the data is plain JSON-like; do not use `structuredClone`, because the core compiles without DOM types), so later mutation of the draft cannot alter a commit. Optionally deep-freeze commits in development.

## Verify, log, diff, blame
- `verifyChain`: loop; check `parentId`, then recompute `commitId` from the commit minus `id`; first failure returns the index.
- `log`: map reversed history; `entryCount = entries.length`, `resolutionCount = resolutions.length`.
- `diffCommits`: build `Map<drugKey, entry>` for both sides; value strings via `formatStrength`, `formatFrequency`, status word; `changed` items use those strings.
- `blame`: for each head entry, `i = head index`; while `i > 0` and the commit at `i-1` has the drugKey with identical value strings, decrement `i`. `blamedCommitId = history[i].id`. `reasonCodes` from `history[i].resolutions` filtered by `conflictId.startsWith(drugKey + '::')` and decision type not escalate. `lastDecision`: loop `j` from head down to 0, find the first commit whose resolutions include one for the drugKey; return its id and codes (escalations excluded; if only escalations exist in that commit, return empty codes).
- Value-string comparison is by `formatEntry` parts, not object identity.

## Replay
For each prior commit: `normaliseSourceList({id:'prior', label:'prior', kind:'prescriber', asOf: at, items}, formulary)`; entries from it (a repeated drugKey keeps the first, because fixtures are validated); `agreements = entries.map(e => ({drugKey: e.drugKey, agreedBy: []}))`; `resolutions: []`; `sourcesSeen: []`; parent chained. Ids come from `commitId`.

## Error handling
All expected failures are `Result` errors. No exceptions.

## Correctness properties (fast-check)
Generators: reuse the merge generators; add `genChain(n)` that builds a history by repeatedly generating sources, merging against the head, resolving every conflict with valid decisions (pharmacist role), and committing with a fixed clock sequence; `genJson` for canonical tests (nested objects with random keys including non-ASCII, arrays, finite numbers, strings).

- **P-H1 Determinism and sensitivity.** Committing the same inputs twice gives equal commits; changing the message, any entry value or the parent id changes the id. Validates: history-audit 1.3, 2.6.
- **P-H2 Canonical key-order independence.** For any JSON-like value, `canonicalise(v)` equals `canonicalise(v')` where `v'` has all object keys shuffled; and it parses back (`JSON.parse`) to a value deeply equal to `v`. Validates: history-audit 2.1, 2.2.
- **P-H3 Tamper evidence.** Any chain from `genChain` verifies. Mutating any one field of one commit (message, an entry value, a resolution reason, `at`, `parentId`, `id`) makes `verifyChain` return `CHAIN_BROKEN` with that commit's index. Validates: history-audit 3.1, 3.2, 3.3.
- **P-H4 Diff consistency.** For adjacent commits, applying `diffCommits` to the parent's value strings reproduces the commit's value strings; `diffCommits(c, c)` is empty. Validates: history-audit 5.1 to 5.5.
- **P-H5 Blame consistency.** For every blame line: the blamed commit holds the drugKey with the head's values; the commit just before it lacks the drugKey or differs; every commit from the blamed one to the head holds identical values. Validates: history-audit 6.2.
- **P-H6 Immutability.** Deep-freeze a history, run `log`, `diffCommits`, `blame`, `verifyChain`, and append a commit; nothing throws and earlier commits are deeply equal afterwards. Validates: history-audit 8.1, 8.2.

## Golden tests
- `tests/golden/canonical.test.ts`: every vector in `data/vectors/canonical.json`; the two `rejects` cases.
- `tests/golden/history-hero.test.ts`: replay the hero prior commits; merge the hero sources against the head; run `demoScript` (see merge-engine 9.4); `commitDraft` with `demoCommit`'s message, author and a fixed clock at `demoCommit.at`; check `verifyChain`, `log` (3 lines), the diff equals `expectedAfterDemoScript.diffVsHead`, blame equals `expectedAfterDemoScript.blame` after mapping indexes to ids, and the id equals an independent recomputation. Validates: history-audit 6.5, 7.3.

## Testing strategy
Vectors and golden tests pin the canonical form and the hero story. Properties cover integrity and consistency. Do not assert specific hash values for scenario commits; assert recomputation equality and the vectors.
