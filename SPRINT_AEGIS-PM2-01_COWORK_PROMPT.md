Execute Sprint AEGIS-PM2-01 — pm2 Migration + ESLint Gate Fix for AEGIS.
Run first. No dependencies.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\aegis\STATUS.md
  Filesystem:read_file D:\Dev\aegis\BACKLOG.md
  Filesystem:read_file D:\Dev\aegis\CHANGELOG.md
  Filesystem:read_file D:\Dev\aegis\BLUEPRINT_MASTER.md
  Filesystem:read_file D:\Dev\aegis\src\activate.ts
  Filesystem:read_file D:\Dev\aegis\package.json

Summary: After this sprint, the AEGIS dashboard-server.js (D:\Meta\dashboard-server.js)
runs under pm2 instead of Windows Task Scheduler. Server bounces become a single
`pm2 restart dashboard` command, executable without elevation from any terminal.
ESLint pre-commit hook no longer blocks commits. Both friction items from BRAVE-02
are closed.

Note: dashboard-server.js lives at D:\Meta\, not inside D:\Dev\aegis\. pm2 manages
it as an ecosystem process. AEGIS owns the pm2 setup and startup script.

Tasks:

1. Fix ESLint gate — D:\Dev\aegis\src\activate.ts:
   - Read the file to identify exact unused vars and no-explicit-any violations
   - Fix unused vars: prefix with _ or remove if truly unused
   - Fix no-explicit-any: replace `any` with proper types or `unknown` where any
     is unavoidable (use type assertions where needed, not wholesale disable)
   - Run: npx eslint src/activate.ts --fix (auto-fixable items)
   - Run: npx eslint src/ to confirm zero new errors introduced
   - Do NOT add eslint-disable comments unless absolutely no other option
   - After fix: confirm git commit --no-verify is no longer needed

2. Install pm2 globally if not present:
   - Check: node D:\Meta\_check_pm2.cjs (create this helper to run: `pm2 --version`)
   - If not installed: npm install -g pm2 (cmd shell, not PowerShell)
   - Verify: pm2 --version outputs a version string

3. Create pm2 ecosystem file — D:\Meta\ecosystem.config.cjs:
   - Use .cjs extension (not .config.js) — avoids ES module conflicts
   - Single app entry: name "dashboard", script "D:\\Meta\\dashboard-server.js"
   - cwd: "D:\\Meta"
   - watch: false (manual restart on change)
   - autorestart: true
   - max_restarts: 10
   - min_uptime: "5s"
   - env: { NODE_ENV: "production", PORT: "7171" }
   - log_file: "D:\\Meta\\dashboard-pm2.log"
   - error_file: "D:\\Meta\\dashboard-pm2-err.log"

4. Register dashboard with pm2 and configure startup:
   - Kill any existing node process on port 7171:
     cmd: for /f "tokens=5" %a in ('netstat -aon ^| findstr ":7171"') do taskkill /F /PID %a
     (wrap in try-catch equivalent — port may already be free)
   - Start via pm2: pm2 start D:\Meta\ecosystem.config.cjs
   - Save pm2 process list: pm2 save
   - Configure pm2 to start on Windows boot: pm2 startup (read the output — it
     will give a command to run, execute it)
   - Verify dashboard is up: pm2 list (should show "dashboard" as "online")
   - Test: node D:\Meta\_test.cjs (confirm /api/projects returns data, not 500)

5. Create bounce helper — D:\Meta\bounce.bat (rewrite existing):
   @echo off
   pm2 restart dashboard
   echo Dashboard restarted.
   pm2 list

6. Remove old Task Scheduler task if it still exists:
   - Check: schtasks /query /fo csv | findstr "Dashboard"
   - If found: schtasks /Delete /TN "Dashboard-7171" /F
   - If not found: skip (already gone)

7. Update D:\Meta\PORTFOLIO_OS.md — add pm2 to §10 infrastructure notes:
   - Add a note under the dashboard entry: "Managed by pm2. Bounce: pm2 restart dashboard"

8. Portfolio compliance check — D:\Meta\:
   - BACKLOG.md: close AEGIS-PM2-01 and ESLint items once done
   - CHANGELOG.md: add AEGIS-PM2-01 entry

<!-- phase:execute -->

9. Quality gate:
   - pm2 list shows "dashboard" as "online"
   - curl http://localhost:7171/api/projects returns JSON (not 500)
   - npx eslint src/ in D:\Dev\aegis\ shows 0 errors (or only pre-existing unrelated)
   - git commit (without --no-verify) succeeds in D:\Dev\aegis\

10. Session close:

    FRICTION PASS (do this before writing MORNING_BRIEFING):
    Collect all friction. Triage FIX NOW / BACKLOG / LOG ONLY.
    Present:
      "Session complete. [summary]
       Friction: [X] fixable now / [Y] to backlog / [Z] informational
       [A] Fix now + log the rest  ← default
       [B] Just log
       [C] Skip"
    Execute chosen path.

    MORNING_BRIEFING.md — write to D:\Dev\aegis\ BEFORE git add.
    Schema: D:\Dev\TEMPLATES\MORNING_BRIEFING_TEMPLATE.md
    Sections: SHIPPED, QUALITY GATES, DECISIONS MADE, UNEXPECTED FINDINGS,
    FRICTION LOG, NEXT QUEUE.

    STATUS.md — update Last Sprint + Last Updated.
    BACKLOG.md — close completed items.
    CHANGELOG.md — add AEGIS-PM2-01 entry.

    git add + commit + push — D:\Dev\aegis\:
    Commit message via D:\Dev\aegis\commit-msg.txt
    git -C D:\Dev\aegis commit -F commit-msg.txt

    Also commit D:\Meta\ changes (ecosystem.config.cjs, bounce.bat, PORTFOLIO_OS.md):
    git -C D:\Meta add -A
    git -C D:\Meta commit -m "feat: pm2 ecosystem config + bounce.bat"
    git -C D:\Meta push

CRITICAL CONSTRAINTS:
- Shell: cmd (not PowerShell). All node/npm/pm2 commands via cmd.
- Git: D:\Program Files\Git\cmd\git.exe — full path. Commit via temp file.
- dashboard-server.js lives at D:\Meta\, not D:\Dev\aegis\ — pm2 points there
- Do NOT modify dashboard-server.js itself — only the process manager changes
- ESLint fix: types only, no logic changes, no eslint-disable sprawl
- MORNING_BRIEFING.md written BEFORE git add, included in the commit

Project: D:\Dev\aegis
Shell: cmd (not PowerShell)
Git: D:\Program Files\Git\cmd\git.exe — full path

ACCEPTANCE CRITERIA:
  pm2 list shows "dashboard" as "online" on port 7171
  D:\Meta\bounce.bat runs pm2 restart dashboard successfully
  http://localhost:7171/api/projects returns valid JSON
  pm2 startup configured — dashboard survives reboot without manual launch
  npx eslint src/activate.ts — 0 errors
  git commit without --no-verify succeeds in D:\Dev\aegis\
  Old Dashboard-7171 Task Scheduler task removed or confirmed already absent
  MORNING_BRIEFING.md written and committed
