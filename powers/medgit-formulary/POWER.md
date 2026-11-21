---
name: "medgit-formulary"
displayName: "MedGit formulary"
description: "Look up and normalise medicine names, strengths and frequencies against MedGit's synthetic formulary, so agents test against the same rules as the app."
keywords: ["medgit", "formulary", "medication", "normalise", "strength", "frequency"]
author: "JANYAVULA VINAY"
---

# MedGit formulary power (optional, build after the Day 10 gate)

This power packages the optional `medgit-formulary` MCP server so that any Kiro agent can ask "what does this raw medicine line normalise to?" without reading the code.

Status: **stub**. The server file `mcp/formulary-server.ts` does not exist until you build it. Until then the server is disabled in `.kiro/settings/mcp.json` and in `mcp.json` here.

## Tools the server should expose
| Tool | Input | Output |
|---|---|---|
| `normalise_item` | `{ name, form?, strength?, frequency?, status? }` | drugKey, display name, strength, frequency, status, issue codes |
| `lookup_drug` | `{ query }` | formulary item whose alias list matches (exact token match only), or none |
| `validate_source_list` | `{ items: RawItem[] }` | per-item normalisation and the list's issues, including duplicates |

All tools call the same core functions as the app (`src/core`), so results always agree with the tests. No network, no keys, no real patient data.

## Steering for agents using this power
- Treat the output as the oracle for normalisation questions.
- Never guess near matches; if a name is not an alias, the answer is unmapped.
- Everything is synthetic. No clinical advice.

## How to build it (about two hours)
1. Install `@modelcontextprotocol/sdk`, `zod`, `tsx` (dev) and write `mcp/formulary-server.ts` with a stdio transport and the three tools above, importing from `../src/core`.
2. Test it with the MCP inspector (`npx @modelcontextprotocol/inspector npx tsx mcp/formulary-server.ts`).
3. Set `"disabled": false` for `medgit-formulary` in `.kiro/settings/mcp.json` and in this folder's `mcp.json`.
4. Install the power from this folder in the Kiro IDE (Powers panel, add from local path), then note in `docs/KIRO_LOG.md` how it helped.
