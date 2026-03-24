Execute Sprint AEGIS-CATALOG-01 — Process Knowledge Base for AEGIS.
Run FIRST. This is the prerequisite for all v3 intelligence work.
Nothing gets targeted before it is understood.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\AEGIS\STATUS.md
  Filesystem:read_file D:\Projects\AEGIS\PROJECT_DNA.yaml
  Filesystem:read_file D:\Projects\AEGIS\VISION.md
  Filesystem:read_file D:\Projects\AEGIS\src\config\types.ts
  Filesystem:read_file D:\Projects\AEGIS\src\tray\lifecycle.ts
  Filesystem:read_file D:\Projects\AEGIS\src\status\server.ts
  Filesystem:read_file D:\Projects\AEGIS\src\status\collector.ts
  Filesystem:read_file D:\Projects\AEGIS\scripts\aegis-worker.ps1

Summary: After this sprint, AEGIS has a process knowledge base. A SQLite database
(catalog.db) exists with schema and 200+ pre-seeded Windows processes — each with
trust tier, blast radius category, publisher, risk label, and action permissions.
An unknown process detection gate is active: any process not in the catalog enters
observation-only mode and AEGIS surfaces it as Unresolved. The Claude identification
bridge is wired: AEGIS can request identification of an unknown process via MCP
and receive a trust assessment back. No action is ever taken on an unresolved process.

Tasks:

1. Install better-sqlite3 — D:\Projects\AEGIS:
   cd /d D:\Projects\AEGIS
   npm install better-sqlite3 @types/better-sqlite3
   Verify: node -e "require('better-sqlite3')" exits 0.

2. Create SQLite catalog schema — D:\Projects\AEGIS\src\catalog\schema.ts:
   Use better-sqlite3 (synchronous — no async wrappers needed).
   Database path: path.join(process.env['APPDATA'] ?? '', 'AEGIS', 'catalog.db')
   Tables:
     process_catalog:
       id INTEGER PRIMARY KEY AUTOINCREMENT
       name TEXT NOT NULL UNIQUE (lowercase, no .exe suffix)
       publisher TEXT
       description TEXT
       trust_tier INTEGER NOT NULL
         (1=system_critical, 2=trusted_system, 3=trusted_app, 4=unknown, 5=suspicious)
       blast_radius_category TEXT NOT NULL
         (none | low | medium | high | critical)
       risk_label TEXT NOT NULL
         (SAFE | CAUTION | DO_NOT_TOUCH | CRITICAL_SYSTEM)
       action_permissions TEXT NOT NULL (JSON array)
         e.g. '["throttle","suspend","kill"]' or '[]' for untouchable
       notes TEXT
       source TEXT NOT NULL (seeded | observed | user | claude_id)
       created_at TEXT NOT NULL
       updated_at TEXT NOT NULL

     unknown_processes:
       id INTEGER PRIMARY KEY AUTOINCREMENT
       name TEXT NOT NULL UNIQUE
       path TEXT
       publisher TEXT
       parent_name TEXT
       network_connections TEXT (JSON array of remote IPs seen)
       first_seen_at TEXT NOT NULL
       last_seen_at TEXT NOT NULL
       observation_count INTEGER NOT NULL DEFAULT 1
       status TEXT NOT NULL DEFAULT 'observing'
         (observing | identified | suspicious | user_approved | user_blocked)
       identification_source TEXT
         (null | claude_id | hash_lookup | cert_check | user)
       resolved_catalog_id INTEGER REFERENCES process_catalog(id)
       notes TEXT

   Export class CatalogDb with methods:
     constructor(dbPath: string)
     getProcess(name: string): CatalogEntry | null
     isKnown(name: string): boolean
     canActOn(name: string, action: 'kill' | 'suspend' | 'throttle'): boolean
     addUnknown(entry: NewUnknownEntry): void
     updateUnknown(name: string, updates: Partial<UnknownEntry>): void
     getSuspicious(): UnknownEntry[]
     getUnresolved(): UnknownEntry[]
     seedFromArray(entries: SeedEntry[]): void
     close(): void

   Export interfaces: CatalogEntry, UnknownEntry, NewUnknownEntry, SeedEntry

3. Create seed catalog — D:\Projects\AEGIS\src\catalog\seed.json:
   Minimum 200 entries. JSON array of SeedEntry objects.
   Required categories and risk assignments:

   CRITICAL_SYSTEM (trust_tier=1, risk_label=CRITICAL_SYSTEM, action_permissions=[]):
     system, smss, csrss, wininit, winlogon, lsass, services, svchost,
     dwm, ntoskrnl, audiodg, fontdrvhost, spoolsv, trustedinstaller,
     wudfhost, lsm, wininit, securityhealthsystray

   TRUSTED_SYSTEM / DO_NOT_TOUCH (trust_tier=2, risk_label=DO_NOT_TOUCH, action_permissions=[]):
     explorer, taskmgr, mmc, regedit, eventvwr, perfmon, resmon, msconfig,
     securityhealthservice, smartscreen, nissrv, msmpsvc

   TRUSTED_SYSTEM / CAUTION (trust_tier=2, risk_label=CAUTION, action_permissions=["throttle"]):
     searchindexer, sysmain, wmpnetwk, bits, diagtrack, wuauclt, wuauserv,
     wsearch, runtimebroker, shellexperiencehost, startmenuexperiencehost,
     textinputhost, ctfmon, conhost, dllhost, taskhostw, sihost,
     backgroundtaskhost, applicationframehost, wmiprvse, useroobebroker,
     wmiadap, wmiapsrv, sppsvc, wlms, netsession

   TRUSTED_APP (trust_tier=3, risk_label=SAFE, action_permissions=["throttle","suspend"]):
     onedrive, teams, slack, discord, zoom, msteams, outlook, winword,
     excel, powerpnt, onenote, skype, telegram, signal, thunderbird,
     spotify, vlc, obs64, obs, steam, epicgameslauncher, origin,
     dropbox, googledrivefs, box, notion, obsidian, figma, postman,
     devenv, rider, clion, pycharm, webstorm, intellij

   DEVELOPMENT (trust_tier=3, risk_label=SAFE, action_permissions=["throttle","suspend","kill"]):
     node, python, python3, git, npm, npx, tsc, pwsh, powershell, cmd,
     code, windowsterminal, wt, bash, wsl, wslhost, vmmem,
     cargo, rustc, go, java, javaw, dotnet, msbuild, gradle, mvn,
     ruby, php, perl, lua, nginx, apache, iis, iisexpress,
     mongod, mysqld, postgres, redis-server, sqlite3

   BROWSERS (trust_tier=3, risk_label=SAFE, action_permissions=["throttle","suspend"]):
     brave, chrome, firefox, msedge, opera, vivaldi, arc, safari,
     chromedriver, geckodriver

   SECURITY (trust_tier=2, risk_label=CAUTION, action_permissions=[]):
     msmpsvc, nissrv, mpcmdrun, securityhealthservice, smartscreen,
     mbam, mbamservice, avgui, avgsvce, avguix, ccsvchst, norton360

   PRODUCTIVITY (trust_tier=3, risk_label=SAFE, action_permissions=["throttle","suspend"]):
     claude, notepad, notepadplusplus, paint, mspaint, wordpad,
     acrobat, acrord32, foxit, sumatra, irfanview, greenshot, snagit,
     loom, camtasia, audacity, handbrake

   For each entry set realistic blast_radius_category:
     critical: lsass, winlogon, services, csrss (system collapses)
     high: explorer, svchost (multiple dependents)
     medium: node (child trees), searchindexer (feeds indexing)
     low: single-app processes with no dependents
     none: fully isolated apps

4. Create CatalogManager — D:\Projects\AEGIS\src\catalog\manager.ts:
   Wraps CatalogDb. Exposes:
     lookup(name: string): CatalogEntry | 'unknown' | 'suspicious'
     recordObservation(proc: { name: string, path?: string, publisher?: string,
       parentName?: string, networkConns?: string[] }): void
       Logic:
         if known → return
         if not in unknown_processes → addUnknown, status='observing'
         if already in unknown_processes → increment observation_count, update last_seen_at
         suspicious heuristics (set status='suspicious' if ALL true):
           - no publisher cert
           - path contains AppData, Temp, or Downloads
           - has external network connections (non-RFC1918)
           - observation_count > 3
     canActOn(name: string, action: 'kill'|'suspend'|'throttle'): boolean
       → false for anything unknown, suspicious, or missing action in permissions
       → this is THE gate — called before ANY action in sniper/rules engine
     requestIdentification(name: string): void
       → emits 'identification_requested' event with process details
     getSuspicious(): UnknownEntry[]
     getUnresolved(): UnknownEntry[]
     getStats(): { total: number, unknown: number, suspicious: number }
   Export singleton: initCatalog(appDataPath: string): CatalogManager
   Export: getCatalog(): CatalogManager (throws if not initialized)

5. Wire CatalogManager into lifecycle.ts:
   Import initCatalog from '../catalog/manager.js'
   After StatusServer.start() and before TabManager init:
     const appDataPath = process.env['APPDATA'] ?? ''
     const catalog = initCatalog(appDataPath)
     catalog.seedIfEmpty() — call seedFromArray with seed.json contents on first run
   Pass catalog to StatsCollector via new setcatalog(catalog) method.
   In StatsCollector.poll(): for each process in the stats response,
     call catalog.recordObservation({ name: proc.name, ... })
   Add to SystemSnapshot type in types.ts:
     unresolved_count?: number
     suspicious_count?: number
   Populate in collector from catalog.getStats().

6. Wire identification endpoint — src/status/server.ts:
   New route: POST /catalog/identify
     Body: { name: string, path?: string, publisher?: string, network?: string[] }
     Calls onIdentificationRequest callback if registered
     Returns { queued: true }
   New route: POST /catalog/resolve
     Body: { name: string, trust_tier: number, risk_label: string,
             action_permissions: string[], notes?: string, source: string }
     Calls onCatalogResolve callback if registered
     Returns { success: true }
   Add onIdentificationRequest and onCatalogResolve callback registration methods.
   In lifecycle.ts register both:
     onIdentificationRequest: log the request, write to
       %APPDATA%\AEGIS\pending_identifications.json (append)
     onCatalogResolve: call catalog.resolveUnknown(name, entry)

<!-- phase:execute -->

7. Add catalog status to HTML status window — src/status/server.ts buildStatusHtml():
   After the existing metrics section, add a "Catalog" section.
   Shows: unresolved count (amber if > 0), suspicious count (red if > 0).
   If suspicious > 0: red banner listing each suspicious process name + path.
   If unresolved > 0: amber list with "Request ID" button per process
     that POSTs to /catalog/identify with the process name.
   Keep it minimal — counts and names. Full drill-down comes in AEGIS-UI-01.

8. Quality gate:
   cd /d D:\Projects\AEGIS
   npx tsc --noEmit
   Zero TypeScript errors required before proceeding.
   Manual verify: node -e "const Database = require('better-sqlite3'); const db = new Database(require('path').join(process.env.APPDATA, 'AEGIS', 'catalog.db')); console.log(db.prepare('SELECT COUNT(*) as c FROM process_catalog').get())"
   Count must be >= 200.
   Verify canActOn: catalog.canActOn('lsass', 'kill') === false
   Verify canActOn: catalog.canActOn('searchindexer', 'throttle') === true

9. Portfolio compliance check — D:\Projects\AEGIS:
   STATUS.md: verify 4-line header. Fix if malformed.
   STATUS.md Open Work: close AEGIS-CATALOG-01 with commit hash.
   BACKLOG.md: move CATALOG-01 to Completed.
   CHANGELOG.md: add [3.0.0-alpha.1] entry.
   10 minutes max.

10. Session close:

    FRICTION PASS:
    Collect all friction. Triage FIX NOW / BACKLOG / LOG ONLY.
    Present:
      "Session complete. Process knowledge base shipped — [N] processes seeded,
       unknown detection gate active, Claude ID bridge wired.
       Friction: [X] fixable / [Y] backlog / [Z] informational
       [A] Fix now + log  ← default  [B] Just log  [C] Skip"
    Execute chosen path.

    MORNING_BRIEFING.md — write to D:\Projects\AEGIS\ BEFORE git add:
    Schema: D:\Dev\TEMPLATES\MORNING_BRIEFING_SCHEMA.md
    Sections: SHIPPED, QUALITY GATES, DECISIONS MADE BY AGENT,
    UNEXPECTED FINDINGS, FRICTION LOG, NEXT QUEUE.
    NEXT QUEUE: recommend AEGIS-MONITOR-01 (runs in parallel, no dependency).

    git add + commit + push:
    cd /d D:\Projects\AEGIS
    Write message to C:\Temp\aegis_commit.txt
    git add -A
    git commit -F C:\Temp\aegis_commit.txt
    git push origin main
    MORNING_BRIEFING.md included in commit.

CRITICAL CONSTRAINTS:
- TypeScript strict mode. npx tsc --noEmit must be zero errors before session close.
- All new code is ADDITIVE. Existing modules only modified where tasks 5, 6, 7
  explicitly name them (lifecycle.ts, collector.ts, server.ts, types.ts).
- canActOn() is the gate. Returns false for ALL unknown/suspicious processes.
  Non-negotiable. The sniper does not shoot what it does not understand.
- Shell: cmd (not PowerShell). cd /d D:\Projects\AEGIS for all commands.
- better-sqlite3 is synchronous. Do not wrap calls in async/await unnecessarily.
- Seed data is factual only — no behavioral baselines, no CPU/memory norms pre-set.
  The catalog tells AEGIS what things ARE. Observation tells it how they behave.
- MORNING_BRIEFING.md written BEFORE git add. Included in commit.

Project: D:\Projects\AEGIS
Shell: cmd (not PowerShell). cd /d D:\Projects\AEGIS
Git: git in PATH. Commit via C:\Temp\aegis_commit.txt. git commit -F commit-msg.txt
TypeScript: npx tsc --noEmit for quality gate.
SQLite: better-sqlite3 (synchronous). Database at %APPDATA%\AEGIS\catalog.db

ACCEPTANCE CRITERIA:
  npx tsc --noEmit passes with zero errors
  catalog.db exists at %APPDATA%\AEGIS\catalog.db after first startup
  process_catalog table has >= 200 rows after seed
  unknown_processes table exists
  CatalogManager.canActOn('lsass', 'kill') === false
  CatalogManager.canActOn('searchindexer', 'throttle') === true
  CatalogManager.isKnown('lsass') === true
  CatalogManager.isKnown('xyznotaprocess123') === false
  POST /catalog/identify returns { queued: true }
  POST /catalog/resolve returns { success: true }
  SystemSnapshot includes unresolved_count and suspicious_count
  Status window shows catalog section with counts
  MORNING_BRIEFING.md exists in D:\Projects\AEGIS\
  STATUS.md: CATALOG-01 closed with commit hash
  BACKLOG.md: CATALOG-01 in Completed
  CHANGELOG.md: entry added
