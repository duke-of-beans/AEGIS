# AEGIS — ARCHITECTURE DECISION: MCP SERVER SEPARATION
# Date: 2026-03-30
# Decision: Option B — separate binary for MCP server
# Status: LOCKED

## The Problem

During BUILD-01 sprint, pkg bundling of the sidecar failed because
@modelcontextprotocol/sdk uses ESM-only entry points that pkg cannot
statically resolve. Multiple workarounds were attempted:

1. Adding SDK to pkg assets → failed (runtime module resolution)
2. Switching to CJS dist paths in imports → failed (TypeScript can't resolve)
3. Using require() inside functions → failed (pkg static analysis still traces it)

## Why Option B Is Correct (Not Just Convenient)

The bundling failure was a signal, not just an obstacle. The MCP server and
the Tauri sidecar are fundamentally different runtime contexts:

SIDECAR (aegis-sidecar.exe):
- Spawned by Tauri as a child process
- Communicates JSON-RPC over stdin/stdout with Rust parent
- Runs continuously as a daemon
- stdin/stdout OWNED by Tauri IPC protocol
- Cannot simultaneously serve MCP clients

MCP SERVER (aegis-mcp.exe):
- Spawned on-demand by MCP clients (Claude Desktop, GregLite, GREGORE)
- Communicates MCP protocol over stdin/stdout with the client
- Stateless per-invocation (MCP stdio pattern)
- stdin/stdout OWNED by MCP transport
- Cannot simultaneously run as Tauri sidecar

Bundling them together means they fight over stdin/stdout.
Even if pkg could bundle it, the runtime behavior would be wrong.

## The Correct Architecture

```
Tauri App
  └── spawns → aegis-sidecar.exe        (JSON-RPC daemon, always running)
                  ├── context engine
                  ├── sniper engine
                  ├── catalog
                  ├── baseline DB
                  └── learning store

Claude Desktop / GregLite / GREGORE
  └── spawns → aegis-mcp.exe            (MCP stdio server, on-demand)
                  └── connects to sidecar via IPC to read state
                      (HTTP or named pipe — sidecar exposes a local query endpoint)
```

Two binaries. Each does one job. Each owns its own stdin/stdout.

## Implementation Plan

### aegis-sidecar (current binary — simplified)
- Remove ALL MCP server code from src/mcp/server.ts
- Remove @modelcontextprotocol/sdk from dependencies entirely
- Remove zod from dependencies (only needed for MCP tool schemas)
- Expose a lightweight local query endpoint (named pipe or localhost HTTP)
  for the MCP binary to read engine state
- Result: pkg bundles cleanly with no ESM issues

### aegis-mcp (new separate binary)
- New directory: D:\Dev\aegis\mcp-server\
- Separate package.json, separate TypeScript project
- Dependencies: @modelcontextprotocol/sdk, zod
- Does NOT use pkg — shipped as plain node script
  (Claude Desktop runs it via `node aegis-mcp.js`, same as KERNL, SHIM, Oktyv)
- Reads AEGIS state by querying the sidecar's local endpoint
- 8 MCP tools remain exactly as designed
- Can be updated independently of the sidecar

### Why plain node script for MCP (not bundled)?
All existing MCP servers (KERNL, SHIM, Oktyv) are plain node scripts.
This is the standard pattern. No bundling needed. ESM works fine.
The sidecar needs bundling because Tauri requires a single binary.
The MCP server has no such requirement.

## Sidecar Local Query Endpoint

The sidecar exposes engine state via a named pipe or localhost port.
The MCP binary connects to this to read:
- context state
- cognitive load
- catalog stats
- sniper watches
- learning confidence

This is also useful for: GregLite status bar, PORTFOL.io integration,
future dashboard queries.

Endpoint: localhost:7474 (or named pipe \\.\pipe\aegis-sidecar)
Protocol: simple JSON request/response (not full JSON-RPC)

## Sprint Required

AEGIS-REFACTOR-01: Split sidecar and MCP server
- Remove MCP code from sidecar/src/mcp/
- Remove @modelcontextprotocol/sdk + zod from sidecar/package.json
- Add localhost:7474 query endpoint to sidecar/src/main.ts
- Create mcp-server/ directory with new package.json
- Move MCP tools to mcp-server/src/server.ts (plain ESM)
- Update claude_desktop_config.json: MCP command → node mcp-server/dist/server.js
- Update ARCHITECTURE.md with new two-binary diagram
- Re-run sidecar build → should now bundle cleanly
- Verify: cargo tauri build succeeds

Priority: P0 — blocks BUILD-01. Run BEFORE anything in the mega-sprint.
Prepend to MEGA-SPRINT: REFACTOR-01 → BUILD-01 → UI-01 → Phase 2...

## Files to Update After This Decision
- ARCHITECTURE.md: add two-binary diagram, update component map
- BACKLOG.md: add AEGIS-REFACTOR-01 as P0 (before BUILD-01)
- sidecar/package.json: remove @modelcontextprotocol/sdk, zod
- sidecar/src/mcp/server.ts: DELETE (move to mcp-server/)
- sidecar/src/main.ts: remove MCP mode, add local query endpoint
- New: mcp-server/ directory

Last updated: 2026-03-30
