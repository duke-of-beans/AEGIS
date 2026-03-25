import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import { getLogger } from '../logger/index.js'

// ============================================================
// Context Types
// ============================================================

export type ContextName =
  | 'deep_work'
  | 'build'
  | 'research'
  | 'meeting'
  | 'media'
  | 'gaming'
  | 'idle'
  | 'unknown'

export interface ForegroundWindow {
  pid: number
  name: string           // process name, lowercase, no .exe
  title: string
  timestamp: number
}

export interface ContextState {
  current: ContextName
  previous: ContextName
  confidence: number     // 0.0 – 1.0
  focus_weights: Record<string, number>  // process name → accumulated focus seconds
  switched_at: number    // epoch ms
  idle_since: number | null
}

// ============================================================
// Context Detection Rules
// ============================================================

// Each rule: list of process names whose presence (weighted by focus time)
// signals this context. First rule with weight > threshold wins.
const CONTEXT_RULES: Array<{
  name: ContextName
  processes: string[]
  min_focus_sec: number
}> = [
  {
    name: 'meeting',
    processes: ['teams', 'msteams', 'zoom', 'discord', 'skype', 'slack', 'googlemeet'],
    min_focus_sec: 30,
  },
  {
    name: 'gaming',
    processes: [
      'steam', 'epicgameslauncher', 'origin', 'battlenet',
      // common game executables — user can extend via config
      'witcher3', 'cyberpunk2077', 'eldenring', 'valheim', 'minecraft',
    ],
    min_focus_sec: 60,
  },
  {
    name: 'media',
    processes: ['vlc', 'obs64', 'obs', 'spotify', 'audacity', 'premiere', 'afterfx', 'davinciresolve'],
    min_focus_sec: 60,
  },
  {
    name: 'build',
    processes: ['node', 'npm', 'npx', 'tsc', 'cargo', 'msbuild', 'gradle', 'mvn', 'rustc', 'python', 'python3'],
    min_focus_sec: 20,
  },
  {
    name: 'deep_work',
    processes: ['claude', 'code', 'cursor', 'windsurf', 'devenv', 'rider', 'pycharm', 'webstorm', 'intellij', 'obsidian', 'notion', 'typora'],
    min_focus_sec: 120,
  },
  {
    name: 'research',
    processes: ['brave', 'chrome', 'firefox', 'msedge', 'arc', 'vivaldi'],
    min_focus_sec: 180,
  },
]

const IDLE_THRESHOLD_SEC = 600  // 10 minutes no foreground activity = idle

// ============================================================
// ContextEngine
// ============================================================

export class ContextEngine extends EventEmitter {
  private pollProcess: ChildProcess | null = null
  private state: ContextState
  private pollIntervalMs = 2000
  private focusDecayIntervalId: ReturnType<typeof setInterval> | null = null
  private isRunning = false
  private logger = getLogger()
  private lastActivityMs = Date.now()

  constructor() {
    super()
    this.state = {
      current: 'unknown',
      previous: 'unknown',
      confidence: 0,
      focus_weights: {},
      switched_at: Date.now(),
      idle_since: null,
    }
  }

  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.spawnPoller()
    // Decay focus weights every 30s — old focus fades away
    this.focusDecayIntervalId = setInterval(() => this.decayWeights(), 30_000)
    this.logger.info('ContextEngine started')
  }

  stop(): void {
    if (!this.isRunning) return
    this.isRunning = false
    if (this.pollProcess !== null) {
      this.pollProcess.kill()
      this.pollProcess = null
    }
    if (this.focusDecayIntervalId !== null) {
      clearInterval(this.focusDecayIntervalId)
      this.focusDecayIntervalId = null
    }
    this.logger.info('ContextEngine stopped')
  }

  getState(): ContextState {
    return { ...this.state, focus_weights: { ...this.state.focus_weights } }
  }

  // Allow user/system to override context name (for named context learning)
  setUserContext(name: ContextName): void {
    this.transitionTo(name, 1.0)
    this.emit('user_override', name)
  }

  // ── Private ──────────────────────────────────────────────

  private spawnPoller(): void {
    // PowerShell one-liner: poll foreground window process name + title every 2s
    // Uses Add-Type to call GetForegroundWindow + GetWindowThreadProcessId
    const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class FgWin {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int max);
}
"@ -Language CSharp -ErrorAction SilentlyContinue
while($true) {
    try {
        $hwnd = [FgWin]::GetForegroundWindow()
        $pid = 0
        [FgWin]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
        $title = New-Object System.Text.StringBuilder 256
        [FgWin]::GetWindowText($hwnd, $title, 256) | Out-Null
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        $name = if ($proc) { $proc.Name } else { '' }
        Write-Output ("{""pid"":$pid,""name"":""$name"",""title"":""$($title.ToString().Replace('"','""'))"",""ts"":" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + "}")
        [Console]::Out.Flush()
    } catch {
        Write-Output ('{"pid":0,"name":"","title":"","ts":' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + '}')
        [Console]::Out.Flush()
    }
    Start-Sleep -Milliseconds ${this.pollIntervalMs}
}
`.trim()

    this.pollProcess = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-Command', psScript,
    ], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })

    this.pollProcess.stdout?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(l => l.trim().length > 0)
      for (const line of lines) {
        try {
          const fw = JSON.parse(line) as { pid: number; name: string; title: string; ts: number }
          this.handleForegroundChange({
            pid: fw.pid,
            name: fw.name.toLowerCase().replace(/\.exe$/i, ''),
            title: fw.title,
            timestamp: fw.ts,
          })
        } catch (_) { /* malformed line */ }
      }
    })

    this.pollProcess.on('exit', () => {
      if (this.isRunning) {
        // Respawn after 3s on unexpected exit
        setTimeout(() => { if (this.isRunning) this.spawnPoller() }, 3000)
      }
    })
  }

  private handleForegroundChange(fw: ForegroundWindow): void {
    if (fw.name === '') return

    this.lastActivityMs = Date.now()
    this.state.idle_since = null

    // Accumulate focus time for this process (2s per poll tick)
    const current = this.state.focus_weights[fw.name] ?? 0
    this.state.focus_weights[fw.name] = current + (this.pollIntervalMs / 1000)

    this.emit('foreground', fw)
    this.evaluateContext()
  }

  private evaluateContext(): void {
    const now = Date.now()
    const idleSec = (now - this.lastActivityMs) / 1000

    // Idle check
    if (idleSec > IDLE_THRESHOLD_SEC) {
      if (this.state.idle_since === null) {
        this.state.idle_since = now - idleSec * 1000
      }
      this.transitionTo('idle', 0.9)
      return
    }

    // Walk rules in priority order
    for (const rule of CONTEXT_RULES) {
      const totalFocus = rule.processes.reduce((sum, p) => {
        return sum + (this.state.focus_weights[p] ?? 0)
      }, 0)

      if (totalFocus >= rule.min_focus_sec) {
        const confidence = Math.min(1.0, totalFocus / (rule.min_focus_sec * 3))
        this.transitionTo(rule.name, confidence)
        return
      }
    }

    // No rule matched with sufficient evidence
    if (this.state.current === 'idle') {
      this.transitionTo('unknown', 0.3)
    }
  }

  private transitionTo(name: ContextName, confidence: number): void {
    if (name === this.state.current) {
      this.state.confidence = confidence
      return
    }
    const previous = this.state.current
    this.state.previous = previous
    this.state.current = name
    this.state.confidence = confidence
    this.state.switched_at = Date.now()
    this.logger.info('Context transition', { from: previous, to: name, confidence })
    this.emit('context_changed', { from: previous, to: name, confidence })
  }

  private decayWeights(): void {
    // Decay all focus weights by 20% every 30s
    // Weights > 30 days of seconds are capped at 7200 (2 hours) to prevent runaway
    for (const key of Object.keys(this.state.focus_weights)) {
      const w = this.state.focus_weights[key]
      if (w === undefined) continue
      const decayed = Math.min(w * 0.8, 7200)
      if (decayed < 1) {
        delete this.state.focus_weights[key]
      } else {
        this.state.focus_weights[key] = decayed
      }
    }
  }
}
