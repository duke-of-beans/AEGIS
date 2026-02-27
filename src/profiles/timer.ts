import { TimerState } from '../config/types.js'
import { getLogger } from '../logger/index.js'

export class ProfileTimer {
  private state: TimerState = {
    active: false,
    target_profile: null,
    return_profile: null,
    started_at: null,
    duration_min: null,
    expires_at: null,
  }
  private expiryTimeout: NodeJS.Timeout | null = null
  private expiredCallback: ((returnProfile: string) => void) | null = null
  private logger = getLogger()

  get isActive(): boolean {
    return this.state.active
  }

  get remainingMs(): number {
    if (!this.state.active || this.state.expires_at === null) {
      return 0
    }

    const remaining = new Date(this.state.expires_at).getTime() - Date.now()
    return Math.max(0, remaining)
  }

  start(targetProfile: string, returnProfile: string, durationMin: number): void {
    this.cancel()

    const now = new Date()
    const expiresAt = new Date(now.getTime() + durationMin * 60 * 1000)

    this.state = {
      active: true,
      target_profile: targetProfile,
      return_profile: returnProfile,
      started_at: now.toISOString(),
      duration_min: durationMin,
      expires_at: expiresAt.toISOString(),
    }

    const delayMs = durationMin * 60 * 1000
    this.expiryTimeout = setTimeout(() => {
      this.handleExpiry()
    }, delayMs)

    this.logger.info('Timer started', {
      target: targetProfile,
      duration: durationMin,
      expires: expiresAt.toISOString(),
    })
  }

  cancel(): void {
    if (this.expiryTimeout !== null) {
      clearTimeout(this.expiryTimeout)
      this.expiryTimeout = null
    }

    if (this.state.active) {
      this.logger.info('Timer cancelled', {
        target: this.state.target_profile,
      })
    }

    this.state = {
      active: false,
      target_profile: null,
      return_profile: null,
      started_at: null,
      duration_min: null,
      expires_at: null,
    }
  }

  onExpired(callback: (returnProfile: string) => void): void {
    this.expiredCallback = callback
  }

  toState(): TimerState {
    return { ...this.state }
  }

  fromState(state: TimerState): void {
    this.cancel()

    if (!state.active || state.expires_at === null) {
      return
    }

    const remaining = new Date(state.expires_at).getTime() - Date.now()

    if (remaining <= 0) {
      this.logger.info('Saved timer already expired')
      return
    }

    this.state = { ...state }
    this.expiryTimeout = setTimeout(() => {
      this.handleExpiry()
    }, remaining)

    this.logger.info('Timer resumed from saved state', {
      target: this.state.target_profile,
      remaining: Math.floor(remaining / 1000),
    })
  }

  private handleExpiry(): void {
    const returnProfile = this.state.return_profile
    this.logger.info('Timer expired', { returnProfile })
    this.cancel()

    if (returnProfile !== null && this.expiredCallback !== null) {
      this.expiredCallback(returnProfile)
    }
  }
}
