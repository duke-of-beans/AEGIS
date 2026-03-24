import { exec } from 'child_process'

let _elevated: boolean | null = null

/**
 * Check whether the current process is running with administrator elevation.
 * Result is cached for the session — safe to call repeatedly without penalty.
 */
export async function checkIsElevated(): Promise<boolean> {
  if (_elevated !== null) return _elevated
  return new Promise((resolve) => {
    exec(
      'powershell.exe -NoProfile -NonInteractive -Command "ConvertTo-Json ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"',
      { windowsHide: true },
      (err, stdout) => {
        _elevated = !err && stdout.trim() === 'true'
        resolve(_elevated)
      }
    )
  })
}

/** Reset cached elevation state (test helper — not for production use). */
export function _resetElevationCache(): void {
  _elevated = null
}
