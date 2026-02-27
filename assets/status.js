// status.js — shared JS for AEGIS HTA windows
// HTA environment: IE11-era JS engine, XMLHttpRequest, window.external, ActiveXObject

const BASE_URL = 'http://localhost:8743'
let currentSnapshot = null
let allProfiles = []
let pollInterval = null
let timerTickInterval = null
let isDragging = false
let dragOffsetX = 0, dragOffsetY = 0

// ── HTTP ──────────────────────────────────────────────────────────────────────
function httpGet(url, cb) {
  const xhr = new XMLHttpRequest()
  xhr.open('GET', url, true)
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try { cb(null, JSON.parse(xhr.responseText)) }
        catch(e) { cb(e, null) }
      } else { cb(new Error('HTTP ' + xhr.status), null) }
    }
  }
  xhr.onerror = function() { cb(new Error('Network error'), null) }
  xhr.send()
}

function httpPost(url, body, cb) {
  const xhr = new XMLHttpRequest()
  xhr.open('POST', url, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try { cb(null, JSON.parse(xhr.responseText)) }
        catch(e) { cb(e, null) }
      } else { cb(new Error('HTTP ' + xhr.status), null) }
    }
  }
  xhr.onerror = function() { cb(new Error('Network error'), null) }
  xhr.send(JSON.stringify(body))
}

// ── STATUS WINDOW ─────────────────────────────────────────────────────────────
function startPolling() {
  fetchStatus()
  pollInterval = setInterval(fetchStatus, 2000)
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
}

function fetchStatus() {
  httpGet(BASE_URL + '/status', function(err, data) {
    if (err) { showOfflineState(); return }
    currentSnapshot = data
    renderStatus(data)
  })
  httpGet(BASE_URL + '/profiles', function(err, data) {
    if (!err && data) { allProfiles = data; renderQuickSwitch(data) }
  })
}
function renderStatus(s) {
  // Update accent color CSS variable
  const color = s.profile.color || '#6b7280'
  document.documentElement.style.setProperty('--accent', color)

  // [B] Profile badge
  const dot = document.getElementById('profile-dot')
  const name = document.getElementById('profile-name')
  const desc = document.getElementById('profile-desc')
  if (dot) dot.style.background = color
  if (name) name.textContent = s.profile.display_name || s.profile.active
  if (desc) desc.textContent = ''

  // [C] Vitals
  renderBar('cpu-bar', 'cpu-val', s.system.cpu_percent, s.system.cpu_percent.toFixed(1) + '%')
  renderBar('ram-bar', 'ram-val', s.system.ram_percent,
    s.system.ram_percent.toFixed(1) + '%  ' + (s.system.ram_used_mb / 1024).toFixed(1) + ' GB')
  const pwrEl = document.getElementById('pwr-val')
  if (pwrEl) pwrEl.textContent = s.system.power_plan

  // [D] Elevated
  renderProcessSection('elevated-section', 'elevated-list', 'elevated-count', s.processes.elevated)
  // [E] Throttled
  renderProcessSection('throttled-section', 'throttled-list', 'throttled-count', s.processes.throttled)

  // [F] Health
  renderHealth(s.health)

  // [G] Timer
  renderTimer(s.timer)

  // [I] History
  renderHistory(s.history)
}

function renderBar(barId, valId, percent, label) {
  const bar = document.getElementById(barId)
  const val = document.getElementById(valId)
  if (!bar || !val) return
  const p = Math.min(100, Math.max(0, percent))
  bar.style.width = p + '%'
  bar.style.background = p > 85 ? 'var(--bar-red)' : p > 70 ? 'var(--bar-amber)' : 'var(--bar-green)'
  val.textContent = label
}

function renderProcessSection(sectionId, listId, countId, processes) {
  const section = document.getElementById(sectionId)
  const list = document.getElementById(listId)
  const count = document.getElementById(countId)
  if (!section || !list || !count) return

  if (!processes || processes.length === 0) {
    section.style.display = 'none'
    return
  }
  section.style.display = ''
  count.textContent = processes.length

  list.innerHTML = ''
  var shown = processes.slice(0, 6)
  shown.forEach(function(proc) {
    var row = document.createElement('div')
    row.className = 'process-row'
    row.innerHTML =
      '<span class="process-name" title="' + proc.name + '">' + proc.name + '</span>' +
      '<span class="process-cpu">' + proc.cpu_priority + '</span>' +
      '<span class="process-io">' + proc.io_priority + '</span>' +
      '<span class="process-status ' + (proc.running ? 'status-live' : 'status-idle') + '"></span>'
    list.appendChild(row)
  })

  if (processes.length > 6) {
    var more = document.createElement('div')
    more.style.cssText = 'font-size:11px;color:var(--text-muted);padding-top:4px;cursor:pointer;'
    more.textContent = '+ ' + (processes.length - 6) + ' more'
    list.appendChild(more)
  }
}
function renderHealth(health) {
  function setDot(id, state) {
    var el = document.getElementById(id)
    if (!el) return
    el.className = 'health-dot ' +
      (state === 'online' || state === 'connected' || state === 'running' ? 'health-online' :
       state === 'restarting' ? 'health-restart' :
       state === 'failed' ? 'health-error' : 'health-offline')
  }
  function setText(id, state) {
    var el = document.getElementById(id)
    if (!el) return
    el.textContent = state.charAt(0).toUpperCase() + state.slice(1)
  }
  setDot('worker-dot', health.worker); setText('worker-text', health.worker)
  setDot('kernl-dot', health.kernl); setText('kernl-text', health.kernl)
}

function renderTimer(timer) {
  var row = document.getElementById('timer-row')
  var text = document.getElementById('timer-text')
  var btn = document.getElementById('timer-btn')
  if (!row || !text || !btn) return

  if (timerTickInterval) { clearInterval(timerTickInterval); timerTickInterval = null }

  if (timer.active && timer.remaining_sec !== null) {
    var remaining = timer.remaining_sec
    function tick() {
      if (remaining <= 0) { clearInterval(timerTickInterval); timerTickInterval = null; return }
      var h = Math.floor(remaining / 3600)
      var m = Math.floor((remaining % 3600) / 60)
      var s = remaining % 60
      var fmt = (h > 0 ? h + ':' : '') + (m < 10 && h > 0 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s
      if (text) text.innerHTML = '<span class="timer-countdown">⏱ ' + fmt + ' remaining</span> → ' + (timer.return_profile || '')
      remaining--
    }
    tick()
    timerTickInterval = setInterval(tick, 1000)
    btn.textContent = 'Cancel'
    btn.onclick = cancelTimer
  } else {
    text.textContent = '⏱ No timer active'
    btn.textContent = 'Set Timer'
    btn.onclick = showTimerForm
  }
}

function renderHistory(history) {
  var el = document.getElementById('history-strip')
  if (!el || !history || history.length === 0) return
  var parts = history.slice(-3).map(function(h) { return h.display_name || h.profile })
  var last = history[history.length - 1]
  var ago = ''
  if (last && last.switched_at) {
    var diff = Math.floor((Date.now() - new Date(last.switched_at).getTime()) / 60000)
    ago = diff < 1 ? 'just now' : diff + 'm ago'
  }
  el.textContent = parts.join(' → ') + (ago ? ' · ' + ago : '')
}

function renderQuickSwitch(profiles) {
  var container = document.getElementById('quick-switch')
  if (!container) return
  container.innerHTML = ''
  profiles.forEach(function(p) {
    var dot = document.createElement('div')
    dot.className = 'qs-dot' + (currentSnapshot && currentSnapshot.profile.active === p.name ? ' active' : '')
    dot.style.background = p.color || '#6b7280'
    dot.title = p.display_name
    dot.onclick = function() { switchProfile(p.name) }
    container.appendChild(dot)
  })
}

function showOfflineState() {
  var name = document.getElementById('profile-name')
  if (name) name.textContent = 'AEGIS offline'
}
// ── PROFILE SWITCHER ──────────────────────────────────────────────────────────
function toggleProfileSwitcher() {
  var sw = document.getElementById('profile-switcher')
  if (!sw) return
  var isOpen = sw.classList.contains('open')
  if (!isOpen) {
    sw.innerHTML = ''
    allProfiles.forEach(function(p) {
      var opt = document.createElement('div')
      opt.className = 'profile-option' + (currentSnapshot && currentSnapshot.profile.active === p.name ? ' active' : '')
      opt.innerHTML =
        '<span class="profile-option-dot" style="background:' + p.color + '"></span>' +
        '<span class="profile-option-name">' + p.display_name + '</span>'
      opt.onclick = function() { switchProfile(p.name); toggleProfileSwitcher() }
      sw.appendChild(opt)
    })
  }
  sw.classList.toggle('open')
}

function switchProfile(name) {
  httpPost(BASE_URL + '/switch', { profile: name }, function(err, data) {
    if (!err) setTimeout(fetchStatus, 300)
  })
}

// ── TIMER ─────────────────────────────────────────────────────────────────────
function showTimerForm() {
  var form = document.getElementById('timer-form')
  if (!form) return
  form.classList.add('open')
  // Populate profile dropdown
  var sel = document.getElementById('timer-profile-sel')
  if (sel) {
    sel.innerHTML = ''
    allProfiles.forEach(function(p) {
      var opt = document.createElement('option')
      opt.value = p.name
      opt.textContent = p.display_name
      sel.appendChild(opt)
    })
  }
}

function hideTimerForm() {
  var form = document.getElementById('timer-form')
  if (form) form.classList.remove('open')
}

function setTimer() {
  var sel = document.getElementById('timer-profile-sel')
  var dur = document.getElementById('timer-duration')
  if (!sel || !dur) return
  var profile = sel.value
  var minutes = parseInt(dur.value, 10)
  if (!profile || isNaN(minutes) || minutes < 1) return
  httpPost(BASE_URL + '/timer/set', { profile: profile, duration_min: minutes }, function(err) {
    hideTimerForm()
    if (!err) setTimeout(fetchStatus, 300)
  })
}

function cancelTimer() {
  httpPost(BASE_URL + '/timer/cancel', {}, function(err) {
    if (!err) setTimeout(fetchStatus, 300)
  })
}

// ── DRAG ──────────────────────────────────────────────────────────────────────
function initDrag(headerEl) {
  if (!headerEl) return
  headerEl.onmousedown = function(e) {
    isDragging = true
    dragOffsetX = e.screenX - window.screenX
    dragOffsetY = e.screenY - window.screenY
    document.onmousemove = function(e2) {
      if (!isDragging) return
      window.moveTo(e2.screenX - dragOffsetX, e2.screenY - dragOffsetY)
    }
    document.onmouseup = function() {
      isDragging = false
      document.onmousemove = null
      document.onmouseup = null
    }
  }
}
// ── KEYBOARD ──────────────────────────────────────────────────────────────────
document.onkeydown = function(e) {
  if ((e || window.event).keyCode === 27) {
    // Escape: close switcher or window
    var sw = document.getElementById('profile-switcher')
    var form = document.getElementById('timer-form')
    if (sw && sw.classList.contains('open')) { sw.classList.remove('open'); return }
    if (form && form.classList.contains('open')) { form.classList.remove('open'); return }
    window.close()
  }
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────
function openSettings() {
  window.open('settings.hta', 'AEGISSettings', 'width=540,height=600')
}

function switchTab(tabName) {
  var tabs = document.querySelectorAll('.tab-btn')
  var contents = document.querySelectorAll('.tab-content')
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].className = 'tab-btn' + (tabs[i].dataset.tab === tabName ? ' active' : '')
  }
  for (var j = 0; j < contents.length; j++) {
    contents[j].className = 'tab-content' + (contents[j].id === 'tab-' + tabName ? ' active' : '')
  }
  // Load tab-specific data
  if (tabName === 'profiles') loadProfilesTab()
  if (tabName === 'integrations') loadIntegrationsTab()
  if (tabName === 'startup') loadStartupTab()
}

function loadProfilesTab() {
  httpGet(BASE_URL + '/profiles', function(err, data) {
    if (err || !data) return
    var list = document.getElementById('profile-list')
    if (!list) return
    list.innerHTML = ''
    data.forEach(function(p) {
      var item = document.createElement('div')
      item.className = 'profile-list-item'
      item.innerHTML =
        '<span class="profile-list-dot" style="background:' + p.color + '"></span>' +
        '<div style="flex:1">' +
          '<div class="profile-list-name">' + p.display_name + '</div>' +
          '<div class="profile-list-desc">' + (p.description || '') + '</div>' +
        '</div>' +
        '<div class="profile-list-actions">' +
          '<button class="settings-btn" onclick="editProfile(\'' + p.name + '\')">Edit</button>' +
          '<button class="settings-btn" onclick="resetProfile(\'' + p.name + '\')">Reset</button>' +
        '</div>'
      list.appendChild(item)
    })
  })
}

function loadIntegrationsTab() {
  httpGet(BASE_URL + '/status', function(err, data) {
    if (err || !data) return
    var kernlStatus = document.getElementById('kernl-status')
    var mcpStatus = document.getElementById('mcp-status')
    if (kernlStatus) kernlStatus.textContent = data.health.kernl === 'connected' ? '● Connected' : '○ Offline'
    if (mcpStatus) mcpStatus.textContent = data.health.mcp === 'running' ? '● Running' : '○ Stopped'
  })
}

function loadStartupTab() {
  // Just show static info for MVP
}
function testKernl() {
  var statusEl = document.getElementById('kernl-test-result')
  if (statusEl) statusEl.textContent = 'Testing...'
  httpGet('http://localhost:3001/health', function(err, data) {
    if (statusEl) statusEl.textContent = err ? '✕ Connection failed' : '● Connected'
  })
}

function copyMcpConfig() {
  var config = '{\n  "aegis": {\n    "command": "C:\\\\Program Files\\\\AEGIS\\\\AEGIS.exe",\n    "args": ["--mcp"]\n  }\n}'
  try {
    var ta = document.createElement('textarea')
    ta.value = config
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    var btn = document.getElementById('copy-mcp-btn')
    if (btn) { btn.textContent = 'Copied!'; setTimeout(function() { btn.textContent = 'Copy to Clipboard' }, 2000) }
  } catch(e) {}
}

function editProfile(name) {
  // Opens the profile YAML in default app via shell
  // In HTA we can use WScript.Shell
  try {
    var shell = new ActiveXObject('WScript.Shell')
    shell.Run('%APPDATA%\\AEGIS\\profiles\\' + name + '.yaml')
  } catch(e) {}
}

function resetProfile(name) {
  if (!confirm('Reset ' + name + ' to default? Your customizations will be lost.')) return
  // POST to reset endpoint (not in blueprint — just show message for MVP)
  alert('To reset, copy the default profile from the install directory to %APPDATA%\\AEGIS\\profiles\\')
}

function copyDebugInfo() {
  if (!currentSnapshot) { alert('No data yet'); return }
  var info = JSON.stringify(currentSnapshot, null, 2)
  var ta = document.createElement('textarea')
  ta.value = info
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
  alert('Debug info copied to clipboard')
}

function openLogFolder() {
  try {
    var shell = new ActiveXObject('WScript.Shell')
    shell.Run('explorer "%APPDATA%\\AEGIS\\logs"')
  } catch(e) {}
}

function openProfilesFolder() {
  try {
    var shell = new ActiveXObject('WScript.Shell')
    shell.Run('explorer "%APPDATA%\\AEGIS\\profiles"')
  } catch(e) {}
}