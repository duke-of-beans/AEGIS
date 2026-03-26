# AEGIS — MORNING BRIEFING
**Date:** 2026-03-25
**Sprint:** AEGIS-MCP-02 — Rich MCP Publisher
**Status:** SHIPPED

## What Happened

AEGIS now exposes its full intelligence stack as an MCP tool server. Eight tools
cover system snapshots, cognitive load, context detection, process tree, sniper
action log, learning confidence, session summaries, and policy overlay injection.
The server runs via `--mcp` flag on the sidecar using stdio transport.

MCP_INTEGRATION.md documents three integration paths: Claude Desktop (drop-in
config), GregLite (client SDK for routing decisions), and GREGORE (intent signals
+ resource confirmation protocol).

## Friction Points

1. **npm `omit=dev` global config** — devDependencies silently skipped during
   `npm install`. Required `--include=dev` flag. This is a recurring issue across
   all sidecar installs on this machine. Consider adding `--include=dev` to the
   sidecar build script or fixing the global npm config.

2. **MCP SDK TS2589** — `@modelcontextprotocol/sdk` Zod-typed `server.tool()`
   overloads trigger "type instantiation is excessively deep" when schemas use
   `.min()/.max()/.default()` chains. Worked around with `(server as any).tool()`
   for the two parameterized tools. This is a known SDK issue, not an AEGIS bug.

3. **tsc compile time** — With MCP SDK types included, `npx tsc --noEmit` takes
   ~75 seconds. Previous sprints completed in ~15s. The SDK's type graph is large.
   Consider `skipLibCheck: true` if this becomes a bottleneck (already set, but
   the SDK's own types still resolve).

## What's Next

- **[P2] AEGIS-UI-01:** Command surface redesign (cockpit polish)
- **[P2] Full Tauri build + NSIS installer test** — cargo build passes, need
  to bundle sidecar and test NSIS output
- Wire GregLite to actually call AEGIS MCP in production (cross-project task)

## Files Changed

- `sidecar/src/mcp/server.ts` — NEW: MCP tool server (8 tools)
- `sidecar/src/main.ts` — MODIFIED: --mcp flag, conditional stdin/heartbeat
- `MCP_INTEGRATION.md` — NEW: integration guide (3 paths)
- `STATUS.md` — UPDATED: MCP-02 shipped
- `BACKLOG.md` — UPDATED: MCP-02 closed
- `CHANGELOG.md` — UPDATED: MCP-02 entry added
- `sidecar/package.json` — MODIFIED: @types/node version fix
