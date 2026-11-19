---
inclusion: fileMatch
fileMatchPattern: ["src/core/**", "tests/**", "data/**", "mcp/**"]
---
# MedGit: clinical safety rules for logic and data

These rules protect users from a tool that looks authoritative. They apply to every change in core logic, tests, data and the MCP server.

## The five invariants
1. **No silent drop.** Every medication in every source ends up either in the agreed list with identical values or inside at least one conflict claim. A drug with an unrecognised name is kept as `unmapped:<slug>`; it is never discarded.
2. **No auto-resolution.** The merge never picks between two differing values. "Clean" means all sources agree. Do not add tie-breakers, source rankings, recency rules or majority votes, even as an option.
3. **No invention.** A missing or unreadable strength or frequency becomes `null` plus an issue. Do not fill it from the formulary, from another source, or from a default. The only default is: a list item with no status is `active`.
4. **Escalation is real.** A conflict marked `escalated` can only be resolved by the `pharmacist` role. The check lives in core, not only in the UI.
5. **Everything is attributable.** Every resolution has a reason code and a role. Every commit has an author role and a time from the injected clock.

## Language rules
- No dosing advice, no safe-range checks, no "recommended", "should take", "safe" or "unsafe" in code, data or copy.
- Do not claim the tool reduces errors or harm. It makes disagreements visible, resolvable and auditable.
- Names of real products appear only as aliases in `data/formulary.json`, as search terms, never as endorsements.

## Data rules
- All patients, dates and lists are invented. Keep the "SYNTHETIC DATA" notice in every scenario, case file and export.
- Never add a real patient identifier, real hospital name or real clinician name.
- The `expected` block in each scenario is hand-checked golden data. If a test fails, fix the code. If you believe the golden value is wrong, stop and ask the human; do not edit it to make the test pass.

## When unsure
Choose the behaviour that shows more to the user (an extra visible conflict) over the one that hides something (a quiet merge). A false alarm costs a click; a hidden discrepancy is the failure this product exists to prevent.
