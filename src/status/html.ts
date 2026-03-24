// ============================================================
// AEGIS Status Window — HTML Builder
// The cockpit. Every metric adjacent to its action.
// ============================================================

export function buildStatusHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AEGIS — Cognitive Resource OS</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,700;1,400&display=swap');

:root {
  --bg:         #06080f;
  --bg2:        #0a0d1a;
  --bg3:        #0e1225;
  --cyan:       #00d4ff;
  --cyan-dim:   #006688;
  --cyan-faint: rgba(0,212,255,0.05);
  --amber:      #ffaa00;
  --amber-dim:  #7a4e00;
  --red:        #e63946;
  --red-dim:    #5c1822;
  --green:      #39d353;
  --green-dim:  #163b20;
  --white:      #c8d4ee;
  --dim:        #3d4e6a;
  --dimmer:     #181f35;
  --border:     #151d33;
  --border2:    #1e2845;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
  color: var(--white);
  font-family: 'JetBrains Mono', Consolas, 'Cascadia Code', 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* CRT scanlines */
body::before {
  content: '';
  position: fixed; inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent 0, transparent 1px,
    rgba(0,0,0,0.07) 1px, rgba(0,0,0,0.07) 2px
  );
  pointer-events: none;
  z-index: 9999;
}

/* Subtle grid atmosphere */
body::after {
  content: '';
  position: fixed; inset: 0;
  background-image:
    linear-gradient(rgba(0,212,255,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,212,255,0.02) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
  z-index: 0;
}

#app {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* ─── HEADER ─────────────────────────────────────────── */
#hdr {
  flex-shrink: 0;
  height: 52px;
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  position: relative;
  overflow: hidden;
}

#hdr::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--cyan-dim) 30%, var(--cyan-dim) 70%, transparent 100%);
  opacity: 0.6;
}

.hdr-wordmark {
  flex-shrink: 0;
  padding: 0 18px 0 16px;
  border-right: 1px solid var(--border);
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}

.wm-name {
  color: var(--cyan);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.12em;
  line-height: 1;
}

.wm-name em {
  font-style: normal;
  color: var(--cyan-dim);
  font-weight: 400;
  font-size: 11px;
}

.wm-sub {
  color: var(--dim);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hdr-load {
  flex-shrink: 0;
  padding: 0 20px;
  border-right: 1px solid var(--border);
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  min-width: 88px;
}

.load-num {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  transition: color 0.6s, text-shadow 0.6s;
  color: var(--dim);
}

.load-num.g { color: var(--green); text-shadow: 0 0 18px rgba(57,211,83,0.4); }
.load-num.a { color: var(--amber); text-shadow: 0 0 18px rgba(255,170,0,0.45); }
.load-num.r { color: var(--red);   text-shadow: 0 0 18px rgba(230,57,70,0.45); }

.load-lbl {
  font-size: 8px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--dim);
}

.hdr-pills {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  flex-wrap: nowrap;
  overflow: hidden;
}

.pill {
  font-size: 9px;
  padding: 3px 7px;
  border: 1px solid var(--border2);
  color: var(--dim);
  letter-spacing: 0.06em;
  white-space: nowrap;
  flex-shrink: 0;
  transition: color 0.3s, border-color 0.3s;
}

.pill.ctx-active   { border-color: var(--cyan-dim); color: var(--cyan); }
.pill.w-online     { border-color: var(--green-dim); color: var(--green); }
.pill.w-fail       { border-color: var(--red-dim); color: var(--red); }
.pill.w-restart    { border-color: var(--amber-dim); color: var(--amber); }
.pill.watch-on     { border-color: var(--amber-dim); color: var(--amber); }
.pill.elevated     { border-color: var(--amber-dim); color: var(--amber); }
.pill.profile-pill { border-color: var(--cyan-dim); color: var(--cyan); cursor: pointer; }
.pill.profile-pill:hover { background: var(--cyan-faint); }

.hdr-right {
  flex-shrink: 0;
  padding: 0 16px;
  border-left: 1px solid var(--border);
  height: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
}

.spinner {
  color: var(--dim);
  font-size: 12px;
  width: 14px;
  text-align: center;
}

/* ─── MAIN LAYOUT ────────────────────────────────────── */
#main {
  flex: 1;
  display: grid;
  grid-template-columns: 194px 1fr 264px;
  overflow: hidden;
  min-height: 0;
}

#panel-left {
  border-right: 1px solid var(--border);
  overflow-y: auto;
  overflow-x: hidden;
}

#panel-center {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--border);
}

#panel-right {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* scrollbars */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--dimmer); }
::-webkit-scrollbar-thumb:hover { background: var(--dim); }

/* ─── SECTION HEADERS ────────────────────────────────── */
.sec {
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  padding: 4px 10px;
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--cyan-dim);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.sec-corner { color: var(--border2); }
.sec-name   { color: var(--dim); letter-spacing: 0.14em; }
.sec-detail { color: var(--dimmer); margin-left: auto; }
.sec-badge  { font-size: 8px; padding: 1px 4px; border: 1px solid; letter-spacing: 0.06em; }
.sec-badge.amber { color: var(--amber); border-color: var(--amber-dim); }
.sec-badge.red   { color: var(--red); border-color: var(--red-dim); }

/* ─── METER BARS ─────────────────────────────────────── */
.meter-row {
  display: flex;
  align-items: center;
  padding: 3px 10px;
  gap: 7px;
  min-height: 16px;
}

.m-label {
  font-size: 9px;
  color: var(--dim);
  letter-spacing: 0.08em;
  width: 30px;
  flex-shrink: 0;
}

.m-track {
  flex: 1;
  height: 3px;
  background: var(--dimmer);
  position: relative;
  overflow: visible;
}

.m-fill {
  height: 100%;
  width: 0;
  transition: width 0.8s cubic-bezier(0.2,0,0.3,1);
  position: relative;
}

.m-fill::after {
  content: '';
  position: absolute;
  right: 0; top: -1px;
  width: 2px; height: 5px;
  background: inherit;
  opacity: 0.5;
}

.m-fill.cpu  { background: var(--cyan); }
.m-fill.ram  { background: var(--green); }
.m-fill.disk { background: var(--amber); }
.m-fill.dpc  { background: var(--red); }
.m-fill.gpu  { background: #a855f7; }

.m-val {
  font-size: 10px;
  color: var(--white);
  width: 32px;
  text-align: right;
  flex-shrink: 0;
  font-weight: 500;
}

.m-sub {
  font-size: 9px;
  color: var(--dim);
  padding: 0 10px 4px;
}

/* ─── CONTEXT PANEL ──────────────────────────────────── */
.ctx-row {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  gap: 6px;
}

.ctx-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--dim);
  flex-shrink: 0;
}
.ctx-dot.active { background: var(--cyan); box-shadow: 0 0 6px var(--cyan); }

.ctx-name {
  font-size: 11px;
  color: var(--white);
  font-weight: 500;
  letter-spacing: 0.04em;
}

.ctx-conf {
  font-size: 9px;
  color: var(--dim);
  margin-left: auto;
}

.overlay-row {
  padding: 2px 10px 2px 22px;
  font-size: 9px;
  color: var(--cyan-dim);
  letter-spacing: 0.04em;
}

.overlay-row::before { content: '↳ '; color: var(--dim); }

/* ─── PROFILE SWITCHER ───────────────────────────────── */
.profile-row {
  display: flex;
  align-items: center;
  padding: 3px 10px;
  gap: 6px;
  cursor: pointer;
  transition: background 0.12s;
}

.profile-row:hover { background: var(--cyan-faint); }

.profile-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--dim);
  flex-shrink: 0;
}

.profile-dot.active { background: var(--cyan); }

.profile-name {
  font-size: 10px;
  color: var(--dim);
  letter-spacing: 0.06em;
}

.profile-name.active {
  color: var(--white);
  font-weight: 500;
}

/* ─── TIMER ──────────────────────────────────────────── */
.timer-block {
  padding: 6px 10px;
  border-top: 1px solid var(--border);
}

.timer-line {
  font-size: 10px;
  color: var(--amber);
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 6px;
}

.timer-route { color: var(--dim); font-size: 9px; }
.timer-cancel { color: var(--dim); font-size: 9px; cursor: pointer; margin-left: auto; }
.timer-cancel:hover { color: var(--red); }

/* ─── CENTER TABS ────────────────────────────────────── */
.tab-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  padding: 0 10px;
  gap: 0;
  height: 26px;
}

.tab {
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dim);
  padding: 0 10px;
  height: 100%;
  display: flex;
  align-items: center;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.tab:hover { color: var(--white); }
.tab.active { color: var(--cyan); border-bottom-color: var(--cyan); }

.tab-count {
  margin-left: 4px;
  font-size: 8px;
  color: var(--dim);
  background: var(--dimmer);
  padding: 0 3px;
}

#center-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* ─── PROCESS TREE ───────────────────────────────────── */
.proc-row {
  display: flex;
  align-items: center;
  padding: 1px 10px;
  min-height: 17px;
  font-size: 11px;
  border-left: 2px solid transparent;
  cursor: default;
  transition: background 0.12s;
}

.proc-row:hover { background: var(--cyan-faint); }
.proc-row.watch { border-left-color: var(--amber); background: rgba(255,170,0,0.03); }
.proc-row.critical { border-left-color: var(--red); background: rgba(230,57,70,0.04); }

.proc-tree { color: var(--border2); white-space: pre; font-size: 10px; flex-shrink: 0; }
.proc-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--white); }
.proc-name.dim { color: var(--dim); font-size: 10px; }
.proc-dev  { width: 14px; text-align: center; flex-shrink: 0; font-size: 9px; }
.proc-dev.elv  { color: var(--amber); }
.proc-dev.crit { color: var(--red); }
.proc-cpu  { width: 38px; text-align: right; flex-shrink: 0; font-size: 10px; font-weight: 500; }
.proc-mem  { width: 40px; text-align: right; flex-shrink: 0; font-size: 10px; color: var(--dim); }
.proc-badge { font-size: 8px; padding: 0 4px; border: 1px solid; margin-left: 4px; flex-shrink: 0; letter-spacing: 0.05em; }
.proc-badge.watch-b { color: var(--amber); border-color: var(--amber-dim); }

.cpu-z { color: var(--border2); }
.cpu-lo { color: var(--dim); }
.cpu-md { color: var(--cyan); }
.cpu-hi { color: var(--amber); }
.cpu-cr { color: var(--red); font-weight: 700; }

.proc-summary {
  padding: 4px 10px;
  font-size: 9px;
  color: var(--dim);
  letter-spacing: 0.04em;
  border-top: 1px solid var(--border);
}

/* ─── DRIVE / NET / GPU TABLES ───────────────────────── */
.data-table { width: 100%; border-collapse: collapse; }

.data-table th {
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dim);
  border-bottom: 1px solid var(--border);
  padding: 4px 10px;
  text-align: left;
  font-weight: 400;
  background: var(--bg2);
  position: sticky;
  top: 0;
}

.data-table td {
  font-size: 10px;
  padding: 3px 10px;
  border-bottom: 1px solid var(--border);
  color: var(--white);
  vertical-align: middle;
}

.data-table td.dim { color: var(--dim); }
.data-table td.amber { color: var(--amber); }
.data-table td.red   { color: var(--red); }
.data-table td.green { color: var(--green); }

.health-dot {
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  margin-right: 6px;
}

.health-dot.healthy { background: var(--green); }
.health-dot.warn    { background: var(--amber); }
.health-dot.bad     { background: var(--red); }

/* ─── ACTION LOG ─────────────────────────────────────── */
#action-log {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.action-entry {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  border-left: 2px solid transparent;
  transition: background 0.12s;
}

.action-entry:hover { background: var(--cyan-faint); }
.action-entry.t { border-left-color: var(--amber); }
.action-entry.s { border-left-color: #ff6600; }
.action-entry.k { border-left-color: var(--red); }

.action-top {
  display: flex;
  align-items: center;
  gap: 5px;
}

.action-time    { font-size: 9px; color: var(--dim); flex-shrink: 0; }
.action-process { font-size: 11px; color: var(--white); font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.action-badge   { font-size: 8px; padding: 1px 5px; border: 1px solid; letter-spacing: 0.07em; flex-shrink: 0; }
.action-badge.t { color: var(--amber); border-color: var(--amber-dim); }
.action-badge.s { color: #ff6600; border-color: #5a2800; }
.action-badge.k { color: var(--red); border-color: var(--red-dim); }
.action-reason  { font-size: 9px; color: var(--dim); margin-top: 2px; line-height: 1.5; }

.action-fb {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.fb-btn {
  font-size: 9px;
  color: var(--dim);
  cursor: pointer;
  background: none;
  border: 1px solid var(--border2);
  padding: 1px 6px;
  font-family: inherit;
  letter-spacing: 0.05em;
  transition: color 0.15s, border-color 0.15s;
}

.fb-btn:hover { color: var(--green); border-color: var(--green-dim); }
.fb-btn.neg:hover { color: var(--red); border-color: var(--red-dim); }

.action-empty {
  padding: 20px 10px;
  font-size: 10px;
  color: var(--dim);
  text-align: center;
  letter-spacing: 0.08em;
}

/* ─── CONFIDENCE ─────────────────────────────────────── */
#confidence-panel {
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.conf-score {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  gap: 8px;
}

.conf-bar-track {
  flex: 1;
  height: 3px;
  background: var(--dimmer);
}

.conf-bar-fill {
  height: 100%;
  background: var(--cyan);
  transition: width 0.8s;
}

.conf-pct   { font-size: 11px; color: var(--white); font-weight: 500; width: 30px; text-align: right; flex-shrink: 0; }
.conf-info  { padding: 0 10px 6px; font-size: 9px; color: var(--dim); }

/* ─── FOOTER ─────────────────────────────────────────── */
#ftr {
  flex-shrink: 0;
  height: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  border-top: 1px solid var(--border);
  background: var(--bg2);
  font-size: 9px;
  color: var(--dim);
  letter-spacing: 0.06em;
  overflow: hidden;
}

.ftr-item { display: flex; align-items: center; gap: 5px; }
.ftr-dot  { width: 4px; height: 4px; border-radius: 50%; background: var(--dim); }
.ftr-dot.green { background: var(--green); }
.ftr-dot.amber { background: var(--amber); }
.ftr-dot.red   { background: var(--red); }
.ftr-val  { color: var(--white); }

/* ─── OFFLINE STATE ──────────────────────────────────── */
#offline-banner {
  display: none;
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--red-dim);
  border: 1px solid var(--red);
  color: var(--red);
  font-size: 10px;
  padding: 6px 16px;
  letter-spacing: 0.1em;
  z-index: 1000;
}

/* ─── EMPTY STATES ───────────────────────────────────── */
.empty { padding: 16px 10px; font-size: 10px; color: var(--dim); text-align: center; }

/* ─── PROFILE SWITCH INPUT ───────────────────────────── */
#profile-input-wrap {
  display: none;
  position: fixed; inset: 0;
  background: rgba(6,8,15,0.85);
  z-index: 500;
  align-items: center;
  justify-content: center;
}

#profile-input-wrap.open { display: flex; }

.profile-modal {
  background: var(--bg2);
  border: 1px solid var(--border2);
  border-top: 2px solid var(--cyan);
  padding: 20px 24px;
  width: 280px;
}

.profile-modal-title {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dim);
  margin-bottom: 12px;
}

.profile-modal input {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border2);
  color: var(--white);
  font-family: inherit;
  font-size: 12px;
  padding: 6px 10px;
  outline: none;
  letter-spacing: 0.04em;
}

.profile-modal input:focus { border-color: var(--cyan-dim); }

.profile-modal-hint {
  font-size: 9px;
  color: var(--dim);
  margin-top: 6px;
}

.profile-modal-btns {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.pm-btn {
  flex: 1;
  background: none;
  border: 1px solid var(--border2);
  color: var(--dim);
  font-family: inherit;
  font-size: 10px;
  padding: 6px;
  cursor: pointer;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: all 0.15s;
}

.pm-btn:hover { border-color: var(--cyan-dim); color: var(--cyan); }
.pm-btn.confirm { border-color: var(--cyan-dim); color: var(--cyan); }
.pm-btn.confirm:hover { background: var(--cyan-faint); }
</style>
</head>
<body>
<div id="app">

  <!-- ── HEADER ────────────────────────────────────────────── -->
  <div id="hdr">
    <div class="hdr-wordmark">
      <div class="wm-name">▌AEGIS<em>▐</em></div>
      <div class="wm-sub">cognitive resource os</div>
    </div>

    <div class="hdr-load">
      <div class="load-num" id="load-num">--</div>
      <div class="load-lbl">COGNITIVE LOAD</div>
    </div>

    <div class="hdr-pills">
      <span class="pill" id="ctx-pill">CTX: --</span>
      <span class="pill" id="worker-pill">WORKER: --</span>
      <span class="pill profile-pill" id="profile-pill" onclick="openProfileModal()">-- </span>
      <span class="pill" id="watch-pill">0 WATCHES</span>
      <span class="pill" id="elev-pill" style="display:none">⚡ ELEVATED</span>
      <span class="pill" id="unres-pill" style="display:none">? UNRESOLVED</span>
    </div>

    <div class="hdr-right">
      <span class="spinner" id="spinner">◐</span>
    </div>
  </div>

  <!-- ── MAIN ──────────────────────────────────────────────── -->
  <div id="main">

    <!-- LEFT PANEL ──────────────────────────────────────── -->
    <div id="panel-left">

      <!-- Vitals -->
      <div class="sec">
        <span class="sec-corner">┌─</span>
        <span class="sec-name">VITALS</span>
      </div>
      <div class="meter-row">
        <div class="m-label">CPU</div>
        <div class="m-track"><div class="m-fill cpu" id="m-cpu-fill"></div></div>
        <div class="m-val" id="m-cpu-val">--%</div>
      </div>
      <div class="meter-row">
        <div class="m-label">RAM</div>
        <div class="m-track"><div class="m-fill ram" id="m-ram-fill"></div></div>
        <div class="m-val" id="m-ram-val">--%</div>
      </div>
      <div class="meter-row">
        <div class="m-label">DISK Q</div>
        <div class="m-track"><div class="m-fill disk" id="m-disk-fill"></div></div>
        <div class="m-val" id="m-disk-val">--</div>
      </div>
      <div class="meter-row">
        <div class="m-label">DPC</div>
        <div class="m-track"><div class="m-fill dpc" id="m-dpc-fill"></div></div>
        <div class="m-val" id="m-dpc-val">--</div>
      </div>
      <div class="m-sub" id="ram-detail"></div>

      <!-- GPU if available -->
      <div id="gpu-left-wrap" style="display:none">
        <div class="meter-row">
          <div class="m-label">GPU</div>
          <div class="m-track"><div class="m-fill gpu" id="m-gpu-fill"></div></div>
          <div class="m-val" id="m-gpu-val">--%</div>
        </div>
        <div class="meter-row">
          <div class="m-label">VRAM</div>
          <div class="m-track"><div class="m-fill gpu" id="m-vram-fill"></div></div>
          <div class="m-val" id="m-vram-val">--%</div>
        </div>
      </div>

      <!-- Context -->
      <div class="sec" style="margin-top:4px">
        <span class="sec-corner">┌─</span>
        <span class="sec-name">CONTEXT</span>
        <span class="sec-detail" id="ctx-conf-detail"></span>
      </div>
      <div class="ctx-row">
        <div class="ctx-dot" id="ctx-dot"></div>
        <div class="ctx-name" id="ctx-name">detecting…</div>
        <div class="ctx-conf" id="ctx-conf"></div>
      </div>
      <div id="overlay-list"></div>

      <!-- Profiles -->
      <div class="sec" style="margin-top:4px">
        <span class="sec-corner">┌─</span>
        <span class="sec-name">PROFILE</span>
      </div>
      <div class="profile-row" onclick="openProfileModal()">
        <div class="profile-dot active" id="prof-dot"></div>
        <div class="profile-name active" id="prof-current">--</div>
      </div>
      <div class="m-sub" style="padding:2px 10px 6px">click to switch</div>

      <!-- Timer -->
      <div id="timer-block" style="display:none" class="timer-block">
        <div class="sec" style="margin-top:0">
          <span class="sec-corner">┌─</span>
          <span class="sec-name">TIMER</span>
        </div>
        <div class="timer-line">
          <span id="timer-target">--</span>
          <span class="timer-route" id="timer-route">→ --</span>
          <span class="timer-cancel" onclick="cancelTimer()">✕ cancel</span>
        </div>
        <div class="m-sub" id="timer-remain"></div>
      </div>

    </div>

    <!-- CENTER PANEL ─────────────────────────────────────── -->
    <div id="panel-center">
      <div class="tab-bar">
        <div class="tab active" data-tab="tree" onclick="switchTab('tree')">TREE <span class="tab-count" id="tc-tree">0</span></div>
        <div class="tab" data-tab="drives" onclick="switchTab('drives')">DRIVES</div>
        <div class="tab" data-tab="network" onclick="switchTab('network')">NETWORK</div>
        <div class="tab" data-tab="gpu" onclick="switchTab('gpu')">GPU</div>
        <div class="tab" data-tab="browser" onclick="switchTab('browser')">TABS <span class="tab-count" id="tc-tabs">0</span></div>
      </div>
      <div id="center-body">
        <div id="tab-tree"><div class="empty">waiting for data…</div></div>
        <div id="tab-drives" style="display:none"><div class="empty">no disk data</div></div>
        <div id="tab-network" style="display:none"><div class="empty">no network data</div></div>
        <div id="tab-gpu" style="display:none"><div class="empty">no GPU data</div></div>
        <div id="tab-browser" style="display:none"><div class="empty">browser not connected</div></div>
      </div>
    </div>

    <!-- RIGHT PANEL ──────────────────────────────────────── -->
    <div id="panel-right">
      <div class="sec">
        <span class="sec-corner">┌─</span>
        <span class="sec-name">ACTION LOG</span>
        <span class="sec-detail" id="action-count">0 actions</span>
      </div>
      <div id="action-log">
        <div class="action-empty">no actions yet — sniper is watching</div>
      </div>

      <div id="confidence-panel">
        <div class="sec">
          <span class="sec-corner">┌─</span>
          <span class="sec-name">CONFIDENCE</span>
        </div>
        <div class="conf-score">
          <div class="conf-bar-track">
            <div class="conf-bar-fill" id="conf-bar" style="width:0"></div>
          </div>
          <div class="conf-pct" id="conf-pct">--%</div>
        </div>
        <div class="conf-info" id="conf-info">loading…</div>
      </div>
    </div>

  </div>

  <!-- ── FOOTER ────────────────────────────────────────────── -->
  <div id="ftr">
    <div class="ftr-item">
      <div class="ftr-dot" id="ftr-status-dot"></div>
      <span id="ftr-version">AEGIS v3.0.0</span>
    </div>
    <div class="ftr-item">
      <span>UP</span><span class="ftr-val" id="ftr-uptime">--</span>
    </div>
    <div class="ftr-item">
      <span>WATCHES</span><span class="ftr-val" id="ftr-watches">0</span>
    </div>
    <div class="ftr-item" style="margin-left:auto">
      <span id="ftr-updated">--</span>
    </div>
  </div>

</div>

<!-- Profile switch modal -->
<div id="profile-input-wrap" onclick="closeProfileModal(event)">
  <div class="profile-modal">
    <div class="profile-modal-title">┌─ SWITCH PROFILE ──────────</div>
    <input type="text" id="profile-input" placeholder="profile name…" onkeydown="profileInputKey(event)">
    <div class="profile-modal-hint" id="profile-hint">enter profile name to switch</div>
    <div class="profile-modal-btns">
      <button class="pm-btn" onclick="closeProfileModal()">CANCEL</button>
      <button class="pm-btn confirm" onclick="doSwitchProfile()">SWITCH</button>
    </div>
  </div>
</div>

<div id="offline-banner">⚠ AEGIS OFFLINE — retrying…</div>

<script>
(function() {
  'use strict';

  var SNAP = null;
  var ACTIVE_TAB = 'tree';
  var OFFLINE = false;
  var SPINNER = ['◐','◓','◑','◒'];
  var SPI = 0;
  var LAST_ACTIONS = [];

  // ── Utilities ──────────────────────────────────────────

  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function ago(ms) {
    var s = Math.floor((Date.now() - ms) / 1000);
    if (s < 5)  return 'just now';
    if (s < 60) return s + 's ago';
    var m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    return Math.floor(m / 60) + 'h' + (m % 60) + 'm ago';
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function setMeter(fillId, valId, pct, label) {
    var f = document.getElementById(fillId);
    var v = document.getElementById(valId);
    if (f) f.style.width = clamp(pct, 0, 100).toFixed(1) + '%';
    if (v) v.textContent = label;
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setHTML(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function setAttr(id, attr, val) {
    var el = document.getElementById(id);
    if (el) el.setAttribute(attr, val);
  }

  function show(id) { var el = document.getElementById(id); if (el) el.style.display = ''; }
  function hide(id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; }

  function cpuClass(val) {
    if (val < 0.1) return 'cpu-z';
    if (val < 2)   return 'cpu-lo';
    if (val < 8)   return 'cpu-md';
    if (val < 20)  return 'cpu-hi';
    return 'cpu-cr';
  }

  // ── Header ─────────────────────────────────────────────

  function renderHeader(snap) {
    var load = snap.cognitive_load || {};
    var score = typeof load.score === 'number' ? load.score : 0;
    var tier = load.tier || 'green';
    var tierChar = tier === 'green' ? 'g' : (tier === 'amber' ? 'a' : 'r');
    var numEl = document.getElementById('load-num');
    if (numEl) {
      numEl.textContent = score.toFixed(0);
      numEl.className = 'load-num ' + tierChar;
    }

    var ctx = snap.context || {};
    var ctxName = (ctx.current || 'unknown').replace(/_/g, '-').toUpperCase();
    var ctxEl = document.getElementById('ctx-pill');
    if (ctxEl) {
      ctxEl.textContent = 'CTX:' + ctxName;
      ctxEl.className = 'pill' + (ctx.current && ctx.current !== 'unknown' ? ' ctx-active' : '');
    }

    var ws = snap.worker_status || 'offline';
    var wEl = document.getElementById('worker-pill');
    if (wEl) {
      wEl.textContent = 'WORKER:' + ws.toUpperCase();
      wEl.className = 'pill w-' + (ws === 'online' ? 'online' : (ws === 'restarting' ? 'restart' : 'fail'));
    }

    var profEl = document.getElementById('profile-pill');
    if (profEl) profEl.textContent = (snap.active_profile || '--').toUpperCase();

    var watches = snap.sniper ? snap.sniper.active_watches : 0;
    var wPill = document.getElementById('watch-pill');
    if (wPill) {
      wPill.textContent = watches + ' WATCH' + (watches !== 1 ? 'ES' : '');
      wPill.className = 'pill' + (watches > 0 ? ' watch-on' : '');
    }

    if (snap.isElevated) show('elev-pill'); else hide('elev-pill');

    var unres = snap.unresolved_count || 0;
    if (unres > 0) {
      show('unres-pill');
      setText('unres-pill', unres + ' UNRESOLVED');
    } else {
      hide('unres-pill');
    }
  }

  // ── Vitals ─────────────────────────────────────────────

  function renderVitals(snap) {
    setMeter('m-cpu-fill', 'm-cpu-val', snap.cpu_percent, snap.cpu_percent.toFixed(0) + '%');
    setMeter('m-ram-fill', 'm-ram-val', snap.memory_percent, snap.memory_percent.toFixed(0) + '%');

    var total = snap.memory_mb_used + snap.memory_mb_available;
    var usedG = (snap.memory_mb_used / 1024).toFixed(1);
    var totG  = (total / 1024).toFixed(0);
    setText('ram-detail', usedG + ' / ' + totG + ' GB');

    if (snap.disk_stats && snap.disk_stats.drives && snap.disk_stats.drives.length > 0) {
      var maxQ = snap.disk_stats.drives.reduce(function(m, d) { return Math.max(m, d.queue_depth || 0); }, 0);
      setMeter('m-disk-fill', 'm-disk-val', clamp(maxQ * 8, 0, 100), maxQ.toFixed(1));
    }

    if (snap.system_extended) {
      var dpc = snap.system_extended.dpc_rate || 0;
      setMeter('m-dpc-fill', 'm-dpc-val', clamp(dpc / 600 * 100, 0, 100), dpc.toFixed(0));
      var up = snap.system_extended.uptime_sec || 0;
      var h = Math.floor(up / 3600);
      var m = Math.floor((up % 3600) / 60);
      setText('ftr-uptime', h + 'h' + m + 'm');
    }

    if (snap.gpu_stats && snap.gpu_stats.available && snap.gpu_stats.gpus && snap.gpu_stats.gpus.length > 0) {
      var gpu = snap.gpu_stats.gpus[0];
      show('gpu-left-wrap');
      setMeter('m-gpu-fill', 'm-gpu-val', gpu.gpu_util_percent, gpu.gpu_util_percent.toFixed(0) + '%');
      var vramPct = gpu.vram_total_mb > 0 ? (gpu.vram_used_mb / gpu.vram_total_mb * 100) : 0;
      setMeter('m-vram-fill', 'm-vram-val', vramPct, ((gpu.vram_used_mb / 1024).toFixed(1)) + 'G');
    } else {
      hide('gpu-left-wrap');
    }
  }

  // ── Context ────────────────────────────────────────────

  function renderContext(snap) {
    var ctx = snap.context || {};
    var name = (ctx.current || 'unknown').replace(/_/g, ' ').toLowerCase();
    setText('ctx-name', name);
    var dot = document.getElementById('ctx-dot');
    if (dot) dot.className = 'ctx-dot' + (ctx.current && ctx.current !== 'unknown' ? ' active' : '');
    if (typeof ctx.confidence === 'number') {
      setText('ctx-conf', Math.round(ctx.confidence * 100) + '%');
    }
    var overlays = ctx.active_overlays || [];
    var html = overlays.map(function(o) {
      return '<div class="overlay-row">' + esc(o) + '</div>';
    }).join('');
    setHTML('overlay-list', html);

    setText('prof-current', (snap.active_profile || '--').toLowerCase());
  }

  // ── Timer ──────────────────────────────────────────────

  function renderTimer(snap) {
    var timer = snap.timer || {};
    if (timer.active && timer.expires_at) {
      show('timer-block');
      setText('timer-target', (timer.target_profile || '--').toUpperCase());
      setText('timer-route', '→ ' + (timer.return_profile || '--').toUpperCase());
      var remain = Math.max(0, new Date(timer.expires_at).getTime() - Date.now());
      var rm = Math.floor(remain / 60000);
      var rs = Math.floor((remain % 60000) / 1000);
      setText('timer-remain', rm + ':' + (rs < 10 ? '0' : '') + rs + ' remaining');
    } else {
      hide('timer-block');
    }
  }

  // ── Process Tree ───────────────────────────────────────

  function buildTree(procs) {
    var byPid = {};
    var children = {};
    procs.forEach(function(p) { byPid[p.pid] = p; });
    procs.forEach(function(p) {
      var ppid = p.parent_pid;
      if (ppid && ppid !== p.pid && byPid[ppid]) {
        if (!children[ppid]) children[ppid] = [];
        children[ppid].push(p);
      }
    });
    var roots = procs.filter(function(p) {
      return !p.parent_pid || p.parent_pid === p.pid || !byPid[p.parent_pid];
    });
    return { roots: roots, children: children };
  }

  function renderNode(node, prefix, isLast, depth, watches, html) {
    if (depth > 7) return;
    var connector = depth === 0 ? '' : (isLast ? '└─ ' : '├─ ');
    var childPrefix = prefix + (depth === 0 ? '' : (isLast ? '   ' : '│  '));
    var watchInfo = watches[node.pid];
    var rowClass = 'proc-row' + (watchInfo ? (watchInfo.zscore > 3 ? ' critical' : ' watch') : '');
    var cpuSec = (node.cpu_user_ms / 1000).toFixed(1);
    var cpuCls = cpuClass(parseFloat(cpuSec));
    var memStr = node.memory_mb >= 1024 ? (node.memory_mb / 1024).toFixed(1) + 'G' : node.memory_mb.toFixed(0) + 'M';
    var name = node.name.length > 20 ? node.name.substring(0, 19) + '…' : node.name;
    var devHtml = '';
    if (watchInfo) {
      devHtml = '<span class="proc-dev ' + (watchInfo.zscore > 3 ? 'crit' : 'elv') + '">' + (watchInfo.zscore > 3 ? '▲' : '△') + '</span>';
    } else {
      devHtml = '<span class="proc-dev"></span>';
    }
    var badge = watchInfo ? '<span class="proc-badge watch-b">WATCH</span>' : '';
    html.push(
      '<div class="' + rowClass + '">' +
      '<span class="proc-tree">' + esc(prefix + connector) + '</span>' +
      '<span class="proc-name">' + esc(name) + '</span>' +
      devHtml +
      '<span class="proc-cpu ' + cpuCls + '">' + cpuSec + '</span>' +
      '<span class="proc-mem">' + memStr + '</span>' +
      badge +
      '</div>'
    );
    var kids = (window._procChildren || {})[node.pid] || [];
    kids.slice(0, 15).forEach(function(child, i) {
      renderNode(child, childPrefix, i === Math.min(kids.length, 15) - 1, depth + 1, watches, html);
    });
    if (kids.length > 15) {
      html.push('<div class="proc-row"><span class="proc-tree">' + esc(childPrefix + '└─ ') + '</span><span class="proc-name dim">+' + (kids.length - 15) + ' more</span></div>');
    }
  }

  function renderTree(snap) {
    var procs = snap.process_tree || [];
    if (procs.length === 0) { setHTML('tab-tree', '<div class="empty">no process data</div>'); setText('tc-tree', '0'); return; }
    setText('tc-tree', procs.length.toString());
    var built = buildTree(procs);
    window._procChildren = built.children;
    var watches = {};
    if (snap.sniper && snap.sniper.recent_actions) {
      snap.sniper.recent_actions.forEach(function(a) { watches[a.pid] = { zscore: 2 }; });
    }
    var html = [];
    var roots = built.roots.slice(0, 60);
    roots.forEach(function(r, i) { renderNode(r, '', i === roots.length - 1, 0, watches, html); });
    if (procs.length > 60) html.push('<div class="proc-summary">showing 60 of ' + procs.length + ' root processes</div>');
    else html.push('<div class="proc-summary">' + procs.length + ' processes</div>');
    setHTML('tab-tree', html.join(''));
  }

  // ── Drives ─────────────────────────────────────────────

  function renderDrives(snap) {
    var disk = snap.disk_stats;
    if (!disk) { setHTML('tab-drives', '<div class="empty">no disk data</div>'); return; }
    var rows = '';
    (disk.physical_disks || []).forEach(function(d) {
      var hc = d.health_status === 'Healthy' ? 'healthy' : (d.health_status === 'Warning' ? 'warn' : 'bad');
      rows += '<tr><td><span class="health-dot ' + hc + '"></span>' + esc(d.friendly_name) + '</td>' +
        '<td class="dim">' + esc(d.media_type) + '</td>' +
        '<td>' + d.size_gb.toFixed(0) + ' GB</td>' +
        '<td class="' + (d.health_status !== 'Healthy' ? 'amber' : '') + '">' + esc(d.health_status) + '</td></tr>';
    });
    (disk.drives || []).forEach(function(d) {
      var freePct = (d.free_gb / d.size_gb * 100);
      var freeCls = freePct < 10 ? 'red' : (freePct < 20 ? 'amber' : '');
      var rMB = (d.read_bytes_sec / 1024 / 1024).toFixed(1);
      var wMB = (d.write_bytes_sec / 1024 / 1024).toFixed(1);
      rows += '<tr><td>' + esc(d.letter) + '</td>' +
        '<td class="dim">' + esc(d.label || '') + '</td>' +
        '<td class="' + freeCls + '">' + d.free_gb.toFixed(1) + ' / ' + d.size_gb.toFixed(0) + ' GB</td>' +
        '<td>' + rMB + ' / ' + wMB + ' MB/s</td></tr>';
    });
    setHTML('tab-drives',
      '<table class="data-table"><thead><tr>' +
      '<th>DRIVE</th><th>TYPE</th><th>FREE</th><th>R / W</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>'
    );
  }

  // ── Network ────────────────────────────────────────────

  function renderNetwork(snap) {
    var net = snap.network_stats;
    if (!net || !net.adapters || net.adapters.length === 0) { setHTML('tab-network', '<div class="empty">no network data</div>'); return; }
    var rows = net.adapters.filter(function(a) { return a.status === 'Up'; }).map(function(a) {
      var sMB = (a.bytes_sent_sec / 1024 / 1024).toFixed(2);
      var rMB = (a.bytes_recv_sec / 1024 / 1024).toFixed(2);
      var name = a.name.length > 24 ? a.name.substring(0, 23) + '…' : a.name;
      return '<tr><td>' + esc(name) + '</td>' +
        '<td class="dim">' + (a.link_speed_mbps > 0 ? a.link_speed_mbps + ' Mbps' : '--') + '</td>' +
        '<td>' + sMB + ' MB/s</td>' +
        '<td>' + rMB + ' MB/s</td></tr>';
    }).join('');
    setHTML('tab-network',
      '<table class="data-table"><thead><tr>' +
      '<th>ADAPTER</th><th>LINK</th><th>SENT</th><th>RECV</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>'
    );
  }

  // ── GPU ────────────────────────────────────────────────

  function renderGpu(snap) {
    var gs = snap.gpu_stats;
    if (!gs || !gs.available || !gs.gpus || gs.gpus.length === 0) { setHTML('tab-gpu', '<div class="empty">no GPU data</div>'); return; }
    var rows = gs.gpus.map(function(g, i) {
      var vPct = g.vram_total_mb > 0 ? (g.vram_used_mb / g.vram_total_mb * 100).toFixed(0) : '--';
      return '<tr>' +
        '<td>' + (g.name || 'GPU ' + i) + '</td>' +
        '<td><span class="' + (g.gpu_util_percent > 80 ? 'cpu-hi' : '') + '">' + g.gpu_util_percent.toFixed(0) + '%</span></td>' +
        '<td>' + (g.vram_used_mb / 1024).toFixed(1) + ' / ' + (g.vram_total_mb / 1024).toFixed(1) + ' GB</td>' +
        '<td class="dim">' + (g.temp_celsius || '--') + '°C · ' + (g.power_watts || '--') + 'W</td>' +
        '</tr>';
    }).join('');
    setHTML('tab-gpu',
      '<table class="data-table"><thead><tr>' +
      '<th>GPU</th><th>UTIL</th><th>VRAM</th><th>TEMP · POWER</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>'
    );
  }

  // ── Browser Tabs ───────────────────────────────────────

  function renderBrowser(snap) {
    var bt = snap.browser_tabs;
    if (!bt || !bt.enabled || !bt.connected) { setHTML('tab-browser', '<div class="empty">browser manager not connected</div>'); setText('tc-tabs', '0'); return; }
    setText('tc-tabs', bt.active.toString());
    var header = '<div class="sec"><span class="sec-corner">┌─</span><span class="sec-name">TABS</span><span class="sec-detail">active:' + bt.active + ' suspended:' + bt.suspended + ' recovered:' + (bt.memory_recovered_mb || 0).toFixed(0) + 'MB</span></div>';
    var rows = (bt.tabs || []).map(function(t) {
      var title = t.title.length > 36 ? t.title.substring(0, 35) + '…' : t.title;
      var suspInfo = t.suspended && t.suspended_ago_min ? ' · ' + t.suspended_ago_min.toFixed(0) + 'm ago' : '';
      return '<div class="proc-row">' +
        '<span class="proc-name' + (t.suspended ? ' dim' : '') + '">' + esc(title) + '</span>' +
        (t.suspended
          ? '<span class="action-badge s" style="font-size:8px">SUSPENDED' + esc(suspInfo) + '</span>'
          : '') +
        '</div>';
    }).join('');
    setHTML('tab-browser', header + rows);
  }

  // ── Action Log ─────────────────────────────────────────

  function renderActionLog(snap) {
    var actions = snap.sniper ? (snap.sniper.recent_actions || []) : [];
    setText('action-count', actions.length + ' action' + (actions.length !== 1 ? 's' : ''));
    if (actions.length === 0) {
      setHTML('action-log', '<div class="action-empty">no actions yet<br>sniper is watching</div>');
      return;
    }
    var html = actions.slice().reverse().map(function(a) {
      var act = (a.action || '').toLowerCase();
      var cls = act.indexOf('throttle') >= 0 ? 't' : (act.indexOf('suspend') >= 0 ? 's' : 'k');
      var label = act.replace(/_/g,' ').toUpperCase();
      var actionId = a.name + '-' + a.timestamp;
      var timeStr = a.timestamp ? ago(a.timestamp) : '--';
      return '<div class="action-entry ' + cls + '">' +
        '<div class="action-top">' +
        '<span class="action-time">' + timeStr + '</span>' +
        '<span class="action-process">' + esc(a.name) + '</span>' +
        '<span class="action-badge ' + cls + '">' + label + '</span>' +
        '</div>' +
        '<div class="action-reason">' + esc(a.reason || '') + '</div>' +
        '<div class="action-fb">' +
        '<button class="fb-btn" onclick="sendFeedback(\'' + esc(actionId) + '\',\'positive\',\'moderate\')">✓ correct</button>' +
        '<button class="fb-btn neg" onclick="sendFeedback(\'' + esc(actionId) + '\',\'negative\',\'moderate\')">✗ wrong</button>' +
        '</div>' +
        '</div>';
    }).join('');
    setHTML('action-log', html);
  }

  // ── Confidence ─────────────────────────────────────────

  function renderConfidence(snap) {
    var conf = snap.confidence || {};
    var score = typeof conf.score === 'number' ? conf.score : 0;
    var pct = (score * 100).toFixed(0);
    var el = document.getElementById('conf-bar');
    if (el) el.style.width = pct + '%';
    setText('conf-pct', pct + '%');
    if (conf.auto_mode_unlocked) {
      setText('conf-info', '● auto mode active · ' + (conf.total_decisions || 0) + ' decisions');
    } else {
      var remain = conf.decisions_until_auto;
      setText('conf-info', (conf.total_decisions || 0) + ' decisions · ' + (remain ? remain + ' until auto' : 'calibrating'));
    }
  }

  // ── Footer ─────────────────────────────────────────────

  function renderFooter(snap) {
    setText('ftr-version', snap.version ? 'AEGIS ' + snap.version : 'AEGIS v3.0.0');
    var watches = snap.sniper ? snap.sniper.active_watches : 0;
    setText('ftr-watches', watches.toString());
    var dot = document.getElementById('ftr-status-dot');
    if (dot) dot.className = 'ftr-dot ' + (snap.worker_status === 'online' ? 'green' : 'red');
    setText('ftr-updated', 'updated just now');
  }

  // ── Center tab rendering ────────────────────────────────

  function renderCurrentTab(snap) {
    switch (ACTIVE_TAB) {
      case 'tree':    renderTree(snap);    break;
      case 'drives':  renderDrives(snap);  break;
      case 'network': renderNetwork(snap); break;
      case 'gpu':     renderGpu(snap);     break;
      case 'browser': renderBrowser(snap); break;
    }
  }

  // ── Main render ────────────────────────────────────────

  function render(snap) {
    renderHeader(snap);
    renderVitals(snap);
    renderContext(snap);
    renderTimer(snap);
    renderCurrentTab(snap);
    renderActionLog(snap);
    renderConfidence(snap);
    renderFooter(snap);
  }

  // ── API calls ──────────────────────────────────────────

  function poll() {
    fetch('/status')
      .then(function(r) { return r.json(); })
      .then(function(snap) {
        SNAP = snap;
        OFFLINE = false;
        hide('offline-banner');
        render(snap);
      })
      .catch(function() {
        OFFLINE = true;
        show('offline-banner');
      });
  }

  window.sendFeedback = function(actionId, signal, intensity) {
    fetch('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_id: actionId, signal: signal, intensity: intensity })
    }).catch(function() {});
  };

  window.cancelTimer = function() {
    fetch('/timer/cancel', { method: 'POST' }).then(poll).catch(function() {});
  };

  window.openProfileModal = function() {
    var modal = document.getElementById('profile-input-wrap');
    var input = document.getElementById('profile-input');
    if (modal) modal.classList.add('open');
    if (input) {
      var hint = document.getElementById('profile-hint');
      if (SNAP && SNAP.active_profile && hint) hint.textContent = 'current: ' + SNAP.active_profile;
      input.value = '';
      setTimeout(function() { input.focus(); }, 50);
    }
  };

  window.closeProfileModal = function(e) {
    if (e && e.target !== document.getElementById('profile-input-wrap')) return;
    var modal = document.getElementById('profile-input-wrap');
    if (modal) modal.classList.remove('open');
  };

  window.profileInputKey = function(e) {
    if (e.key === 'Enter') window.doSwitchProfile();
    if (e.key === 'Escape') window.closeProfileModal();
  };

  window.doSwitchProfile = function() {
    var input = document.getElementById('profile-input');
    if (!input || !input.value.trim()) return;
    var name = input.value.trim();
    fetch('/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: name })
    }).then(function() {
      window.closeProfileModal();
      setTimeout(poll, 300);
    }).catch(function() {
      var hint = document.getElementById('profile-hint');
      if (hint) hint.textContent = '⚠ switch failed';
    });
  };

  // ── Tab switching ──────────────────────────────────────

  window.switchTab = function(tab) {
    ACTIVE_TAB = tab;
    ['tree','drives','network','gpu','browser'].forEach(function(t) {
      var panel = document.getElementById('tab-' + t);
      if (panel) panel.style.display = t === tab ? '' : 'none';
    });
    document.querySelectorAll('.tab').forEach(function(el) {
      el.classList.toggle('active', el.getAttribute('data-tab') === tab);
    });
    if (SNAP) renderCurrentTab(SNAP);
  };

  // ── Spinner ────────────────────────────────────────────

  setInterval(function() {
    SPI = (SPI + 1) % 4;
    setText('spinner', SPINNER[SPI]);
  }, 700);

  setInterval(poll, 3000);
  poll();

})();
</script>
</body>
</html>`;
}
