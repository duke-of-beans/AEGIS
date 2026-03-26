# AEGIS MCP Integration Guide

AEGIS exposes a Model Context Protocol (MCP) tool server via the sidecar's stdio
transport. Any MCP client can query machine state, context, cognitive load, and
push temporary policy overlays.

## Starting the MCP Server

```
node sidecar/dist/main.js --mcp
```

The `--mcp` flag switches the sidecar from its normal Tauri JSON-RPC mode to
MCP stdio mode. All intelligence engines (context, sniper, catalog, learning,
cognitive load) initialize before the MCP transport connects.

## Available Tools

| Tool | Description |
|------|-------------|
| `get_system_snapshot` | Full system state: context, load, catalog, confidence, watches, policies |
| `get_cognitive_load` | Load score (0-100), tier (green/amber/red), pressure breakdown |
| `get_context` | Current detected context, confidence, focus weights, recent transitions |
| `get_process_tree` | Active sniper watches, catalog stats, unresolved/suspicious processes |
| `get_action_log` | Recent sniper actions with reasoning and escalation state |
| `get_confidence` | Learning confidence score, auto mode status, decision stats |
| `get_session_summary` | Current session: context, load, watches, recent session history |
| `apply_policy_overlay` | Push temporary policy (name, duration, domain). Auto-expires. |

## Integration Path 1: Claude Desktop

Add to `claude_desktop_config.json` (typically at
`%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "aegis": {
      "command": "node",
      "args": ["D:\\Dev\\aegis\\sidecar\\dist\\main.js", "--mcp"]
    }
  }
}
```

Restart Claude Desktop. AEGIS tools appear in the tool list. Claude can then
query machine state during conversations — for example, checking cognitive load
before suggesting resource-intensive operations, or detecting that you're in a
build context and adjusting its recommendations accordingly.

Example prompt: "What's my machine's current cognitive load? Should I start
another build?"

Claude calls `get_cognitive_load`, sees the score and tier, and gives informed
advice based on actual system pressure.

## Integration Path 2: GregLite

GregLite can query AEGIS MCP for machine state to inform its routing decisions.
The sidecar runs as a pm2-managed process alongside GregLite.

**Setup:**

1. AEGIS sidecar is already running via pm2 (`ecosystem.config.cjs`).
2. GregLite spawns a second sidecar instance in MCP mode for queries:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const transport = new StdioClientTransport({
  command: 'node',
  args: ['D:\\Dev\\aegis\\sidecar\\dist\\main.js', '--mcp'],
})
const client = new Client({ name: 'greglite', version: '1.0.0' })
await client.connect(transport)

// Query machine state before routing decisions
const snapshot = await client.callTool({ name: 'get_system_snapshot' })
const load = await client.callTool({ name: 'get_cognitive_load' })
```

**Use cases:**
- GregLite checks cognitive load before spawning Opus subagents
- Context detection informs which persona responds (build context = technical persona)
- Sniper watch count indicates system pressure — defer non-urgent work

## Integration Path 3: GREGORE

GREGORE uses AEGIS MCP to send intent signals and receive resource confirmation
before executing system-level operations.

**Setup:** Same client pattern as GregLite (spawn MCP sidecar, connect client).

**Protocol:**

1. GREGORE announces intent via `apply_policy_overlay`:
   ```
   apply_policy_overlay({
     name: "gregore_deployment",
     duration_min: 15,
     domain: "cpu",
     description: "GREGORE deployment: reserving CPU headroom for 15 min"
   })
   ```

2. GREGORE checks resource availability before heavy operations:
   ```
   get_cognitive_load()  → if tier === 'red', defer deployment
   get_context()         → if context === 'meeting', defer noisy ops
   ```

3. GREGORE monitors sniper state to avoid conflicts:
   ```
   get_action_log()      → check if sniper is actively managing processes
   get_process_tree()    → verify target processes aren't under watch
   ```

**Key principle:** GREGORE never acts blind. It asks AEGIS for permission
via machine state queries, not by overriding policies. AEGIS is the authority
on what the machine can handle.

## Transport Notes

All integrations use stdio transport (MCP over stdin/stdout). The sidecar
writes intelligence engine logs to stderr, keeping the MCP protocol channel
clean. HTTP transport is planned for v2 but not implemented.

The `--mcp` flag is mutually exclusive with normal sidecar mode (Tauri
JSON-RPC). Each consumer spawns its own MCP sidecar instance. The engines
share the same SQLite databases (WAL mode), so state is consistent across
instances.
