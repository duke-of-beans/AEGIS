import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { getLogger } from '../logger/index.js'

// systray2 is a CJS module with a .default export — ESM default import fails at runtime.
// Use createRequire to get the actual constructor.
const require = createRequire(import.meta.url)
const systrayModule = require('systray2') as { default: typeof import('systray2').default }
const SysTray = systrayModule.default
import { buildMenu } from './menu.js'
import type { BrowserMenuStats } from './menu.js'
import type { Menu, ClickAction } from 'systray2'
import type { LoadedProfile } from '../config/types.js'

export interface TrayDependencies {
  onProfileSwitch?: (profileName: string) => Promise<void>
  onTimerSet?: (
    targetProfile: string,
    returnProfile: string,
    durationMin: number
  ) => Promise<void>
  onTimerCancel?: () => Promise<void>
  onStatusWindowOpen?: () => Promise<void>
  onSettingsOpen?: () => Promise<void>
  onQuit?: () => Promise<void>
  onSuspendTabs?: () => Promise<void>
  onRestoreTabs?: () => Promise<void>
  onLaunchBrave?: () => void
}

export class TrayManager {
  private systray: InstanceType<typeof SysTray> | null = null
  private currentMenu: Menu | null = null
  private deps: TrayDependencies
  private logger = getLogger()

  constructor(deps: TrayDependencies) {
    this.deps = deps
  }

  init(
    iconPath: string,
    profiles: LoadedProfile[],
    activeProfile: string,
    profileOrder: string[],
    cpuPercent: number
  ): void {
    const iconData = readFileSync(iconPath)
    const iconBase64 = iconData.toString('base64')

    this.currentMenu = buildMenu({
      profiles,
      activeProfile,
      profileOrder,
      cpuPercent,
      activeProfileColor: '',
    })

    this.currentMenu.icon = iconBase64

    this.systray = new SysTray({
      menu: this.currentMenu,
      debug: false,
      copyDir: true,
    })

    this.systray.onClick((action: ClickAction) => {
      this.handleMenuAction(action)
    })

    this.logger.info('Tray manager initialized')
  }

  updateIcon(iconPath: string): void {
    if (this.systray === null || this.currentMenu === null) {
      return
    }

    const iconData = readFileSync(iconPath)
    const iconBase64 = iconData.toString('base64')

    this.currentMenu.icon = iconBase64
    this.systray.sendAction({
      type: 'update-icon',
      item: this.currentMenu,
    })
  }

  updateTooltip(text: string): void {
    if (this.systray === null || this.currentMenu === null) {
      return
    }

    this.currentMenu.tooltip = text
  }

  updateMenu(
    profiles: LoadedProfile[],
    activeProfile: string,
    profileOrder: string[],
    cpuPercent: number,
    browserStats?: BrowserMenuStats,
    browserCdpPort?: number,
    browserCdpConnected?: boolean
  ): void {
    if (this.systray === null) {
      return
    }

    const newMenu = buildMenu({
      profiles,
      activeProfile,
      profileOrder,
      cpuPercent,
      activeProfileColor: '',
      ...(browserStats !== undefined ? { browserStats } : {}),
      ...(browserCdpPort !== undefined ? { browserCdpPort } : {}),
      ...(browserCdpConnected !== undefined ? { browserCdpConnected } : {}),
    })

    if (this.currentMenu?.icon !== undefined) {
      newMenu.icon = this.currentMenu.icon
    }

    this.currentMenu = newMenu
    this.systray.sendAction({
      type: 'update-menu',
      item: this.currentMenu,
    })
  }

  destroy(): void {
    if (this.systray !== null && !this.systray.killed) {
      this.systray.kill(true)
    }
    this.systray = null
    this.logger.info('Tray manager destroyed')
  }

  private handleMenuAction(action: ClickAction): void {
    const seqId = action.seq_id
    const item = action.item

    if (seqId === 0) {
      return
    }

    if (item.title.includes('Status Window')) {
      if (this.deps.onStatusWindowOpen !== undefined) {
        void this.deps.onStatusWindowOpen()
      }
      return
    }

    if (item.title.includes('Settings')) {
      if (this.deps.onSettingsOpen !== undefined) {
        void this.deps.onSettingsOpen()
      }
      return
    }

    if (item.title.includes('Quit')) {
      if (this.deps.onQuit !== undefined) {
        void this.deps.onQuit()
      }
      return
    }

    if (item.title === 'Cancel' && this.deps.onTimerCancel !== undefined) {
      void this.deps.onTimerCancel()
      return
    }

    if (
      item.title.includes('minute') ||
      item.title.includes('hour')
    ) {
      let durationMin = 0
      if (item.title.includes('5')) durationMin = 5
      else if (item.title.includes('15')) durationMin = 15
      else if (item.title.includes('30')) durationMin = 30
      else if (item.title.includes('1 hour')) durationMin = 60

      if (durationMin > 0 && this.deps.onTimerSet !== undefined) {
        const activeProfile = this.currentMenu?.items
          .find((m) => m.checked)
          ?.title?.replace(/[●○]\s/, '')

        if (activeProfile !== undefined) {
          void this.deps.onTimerSet(activeProfile, activeProfile, durationMin)
        }
      }
      return
    }

    if (item.title === 'Launch Brave (with CDP)') {
      if (this.deps.onLaunchBrave !== undefined) {
        void this.deps.onLaunchBrave()
      }
      return
    }

    if (item.title === 'Suspend Inactive Tabs Now') {
      if (this.deps.onSuspendTabs !== undefined) {
        void this.deps.onSuspendTabs()
      }
      return
    }

    if (item.title === 'Restore All Tabs') {
      if (this.deps.onRestoreTabs !== undefined) {
        void this.deps.onRestoreTabs()
      }
      return
    }

    if (item.title.startsWith('○ ') || item.title.startsWith('● ')) {
      const profileName = item.title.replace(/[●○]\s/, '')
      if (this.deps.onProfileSwitch !== undefined) {
        void this.deps.onProfileSwitch(profileName)
      }
    }
  }
}
