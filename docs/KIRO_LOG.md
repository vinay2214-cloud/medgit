# Kiro usage log

Running notes for the hackathon write-up. Add short, factual entries as you build. Only record what really happened. Delete headings you do not use.

## Provenance
- The specs (`.kiro/specs/*`), steering files, docs, fixtures and scripts in the starter pack were drafted with Claude before the build and then loaded into Kiro. All product code and tests are built with Kiro.
- Repository created on: YYYY-MM-DD (first commit date; it must be on or after the hackathon start for a new project).

## Specs
- (what the spec workflow did for you; any requirement the agent asked to clarify; any spec you changed and why)

## Steering
- (a rule that changed the output; a rule you added or tightened)

## Hooks
- (one real block by `protect-contract`; one `core-checks` failure and the fix; any hook you disabled and why)

## Custom agents
- `medgit-builder`: (what it did well and badly)
- `ui-critic`: (findings that led to changes)
- `safety-reviewer`: (findings that led to changes)

## MCP
- shadcn: (components added, one moment it helped)
- Playwright: (screenshot loop; one defect it caught)
- Context7: (one API detail it corrected)

## Property-based testing
- (a property that found a real bug; the counterexample; the fix; which properties exist at the end)

## Powers
- (only if you built and installed one)

## Kiro Crew, CLI and Web
- (only what you used)

## Numbers (fill in at the end)
- Specs: 6. Requirements (acceptance criteria): see `node scripts/check-traceability.mjs --report`.
- Tests: unit and golden: __; properties: __ at 100 runs; e2e: __.
- Days spent: __. Credits used: __ (if you want to mention it).

## Lessons
- (three things you would tell another builder)
