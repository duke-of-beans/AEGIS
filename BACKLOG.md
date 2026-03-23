# AEGIS — BACKLOG
Last Updated: 2026-03-22 (AEGIS-PM2-01 closed)

## P1 — High Priority
- [ ] AEGIS-ELEV-01: elevation gate missing from manager.ts — flagged BRAVE-02, browser features unaffected but gap exists

## P2 — Normal Queue
- [ ] AEGIS-BRAVE-03: tab suspension UI — activate/restore from status window
- [ ] Per-profile CDP port config (currently hardcoded)

## P3 — Eventually
- [ ] Visual rule editor for profiles
- [ ] Historical performance graphs (CPU/RAM over time)
- [ ] pm2 boot health-check — verify resurrect succeeded at logon (write a small check script)

## Completed
- [x] AEGIS-PM2-01: pm2 migration — ecosystem.config.cjs, bounce.bat, startup resurrect (2026-03-22)
- [x] ESLint gate: tab-manager.ts, cdp-client.ts, menu.ts, lifecycle.ts, index.ts (2026-03-22)
- [x] BRAVE-02: status window tab panel, Brave launch helper, per-profile suspension config (a364fd3)
- [x] BRAVE-01: Brave tab manager — CDP client, tab tracking, suspension engine
- [x] v2.0.0: installer built (AEGIS-Setup-2.0.0.exe), installed to D:\Dev\aegis\
- [x] Startup tasks removed (AEGIS_Startup, AEGIS Cognitive Resource Manager)
