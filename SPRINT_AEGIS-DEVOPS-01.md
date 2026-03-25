Execute Sprint AEGIS-DEVOPS-01 — Pre-Push Lint Gate for AEGIS.
Run in parallel with AEGIS-COCKPIT-02 and AEGIS-INTEL-01.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\AEGIS\STATUS.md
  Filesystem:read_file D:\Projects\AEGIS\BACKLOG.md
  Filesystem:read_file D:\Projects\AEGIS\package.json
  Filesystem:read_file D:\Projects\AEGIS\.eslintrc.cjs

Summary: After this sprint, no broken commit can reach GitHub from this machine.
A git pre-push hook runs npm run lint automatically before every push. If lint
fails, the push is blocked with a clear error message. CI will never receive
a broken commit again.

Tasks:

1. Write git pre-push hook — D:\Projects\AEGIS\.git\hooks\pre-push:
   Write a POSIX shell script (#!/bin/sh) that:
   - cd to the repo root via git rev-parse --show-toplevel
   - Runs npm run lint
   - If exit code != 0: prints a clear blocked message with the exit code
     and the offending lint output, then exits 1 (blocking the push)
   - If exit code == 0: prints "Lint passed. Pushing..." and exits 0
   - Include a note at the top: "To skip in emergency: git push --no-verify"
   The file must be executable. On Windows with Git for Windows, the hook is
   run via sh.exe from Git's bin directory. Write the file, then use
   Desktop Commander start_process with cmd shell to mark it executable:
     git update-index --chmod=+x .git/hooks/pre-push
   Verify the hook file exists and is non-empty after writing.

<!-- phase:execute -->

2. Verify hook triggers correctly:
   Temporarily introduce a lint error in src/catalog/manager.ts
   (add an unused variable: const _testLintError = 1;)
   Attempt a push via: git push origin main --dry-run
   Confirm output contains the blocked message and the lint error.
   Remove the temporary lint error immediately after.
   Run npm run lint again to confirm 0 errors remain.

3. Add hook documentation to README or CONTRIBUTING.md:
   If CONTRIBUTING.md exists: add a section "Development" with:
     - Run npm run lint before pushing (enforced by pre-push hook)
     - To skip in emergency only: git push --no-verify
   If no CONTRIBUTING.md: add the section to README.md under a ## Development header.

4. Quality gate:
   npm run lint — must exit 0 with 0 errors
   npx tsc --noEmit — must exit 0
   .git/hooks/pre-push file exists and is non-empty
   Hook correctly blocked on a test lint error (confirmed in task 2)

5. Portfolio compliance check — D:\Projects\AEGIS:
   - STATUS.md: verify 4-line machine-readable header exists and is current
   - BACKLOG.md: verify AEGIS-DEVOPS-01 is present and mark it closed with commit hash
   - CHANGELOG.md: add AEGIS-DEVOPS-01 entry

6. Session close:
   FRICTION PASS: collect all friction. Triage FIX NOW / BACKLOG / LOG ONLY.
   Present to user before MORNING_BRIEFING.

   MORNING_BRIEFING.md — write to D:\Projects\AEGIS\ BEFORE git add:
   Sections: SHIPPED, QUALITY GATES, DECISIONS MADE BY AGENT,
   UNEXPECTED FINDINGS, FRICTION LOG, NEXT QUEUE.

   git add + commit + push — include MORNING_BRIEFING.md, STATUS.md,
   BACKLOG.md, CHANGELOG.md in commit.
   Commit message via D:\Projects\AEGIS\commit-msg.txt.
   Use: "D:\Program Files\Git\cmd\git.exe" commit -F commit-msg.txt

CRITICAL CONSTRAINTS:
- Shell: cmd (not PowerShell). GREGORE PS profile intercepts npm calls.
- Git: use full path "D:\Program Files\Git\cmd\git.exe" for all git operations.
- Commit messages via commit-msg.txt. git commit -F commit-msg.txt.
- All new code is ADDITIVE. No existing files modified except CONTRIBUTING.md/README.md
  for the documentation addition.
- MORNING_BRIEFING.md written to D:\Projects\AEGIS\ BEFORE git add. Included in commit.
- Quality gate: npm run lint (0 errors) + npx tsc --noEmit (0 errors). Both must pass.
- The pre-push hook is a LOCAL git hook — it does not get committed to the repo.
  It lives in .git/hooks/ which is gitignored. This is correct behavior.

Project: D:\Projects\AEGIS
Shell: cmd (not PowerShell). cd /d D:\Projects\AEGIS
Git: "D:\Program Files\Git\cmd\git.exe" — full path required.

ACCEPTANCE CRITERIA:
  .git/hooks/pre-push exists, non-empty, executable
  Attempting to push with a lint error blocks the push and prints the error
  npm run lint exits 0 after removal of test error
  npx tsc --noEmit exits 0
  MORNING_BRIEFING.md written to D:\Projects\AEGIS\
  STATUS.md updated, AEGIS-DEVOPS-01 closed in BACKLOG.md
