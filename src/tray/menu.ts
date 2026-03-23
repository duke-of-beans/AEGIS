import type { Menu, MenuItem } from 'systray2'
import { LoadedProfile } from '../config/types.js'

export interface BrowserMenuStats {
  active: number
  suspended: number
}

export interface MenuBuildOptions {
  profiles: LoadedProfile[]
  activeProfile: string
  profileOrder: string[]
  cpuPercent: number
  activeProfileColor: string
  browserStats?: BrowserMenuStats
}

export function buildMenu(options: MenuBuildOptions): Menu {
  const items: MenuItem[] = []

  const headerText = `AEGIS · ${options.activeProfile || 'none'} · CPU ${Math.round(
    options.cpuPercent
  )}%`
  items.push({
    title: headerText,
    tooltip: 'AEGIS System Optimizer',
    checked: false,
    enabled: false,
  })

  items.push({
    title: '─────────────',
    tooltip: '',
    checked: false,
    enabled: false,
  })

  const orderedProfiles = options.profileOrder
    .map((name) => options.profiles.find((p) => p.name === name))
    .filter((p): p is LoadedProfile => p !== undefined)

  const unorderedProfiles = options.profiles.filter(
    (p) => !options.profileOrder.includes(p.name)
  )

  const allProfiles = [...orderedProfiles, ...unorderedProfiles]

  for (const profile of allProfiles) {
    const isActive = profile.name === options.activeProfile
    const prefix = isActive ? '● ' : '○ '

    items.push({
      title: prefix + profile.display_name,
      tooltip: profile.description,
      checked: isActive,
      enabled: true,
    })
  }

  items.push({
    title: '─────────────',
    tooltip: '',
    checked: false,
    enabled: false,
  })

  items.push({
    title: 'Timer',
    tooltip: 'Set profile timer',
    checked: false,
    enabled: true,
    items: [
      {
        title: '5 minutes',
        tooltip: '',
        checked: false,
        enabled: true,
      },
      {
        title: '15 minutes',
        tooltip: '',
        checked: false,
        enabled: true,
      },
      {
        title: '30 minutes',
        tooltip: '',
        checked: false,
        enabled: true,
      },
      {
        title: '1 hour',
        tooltip: '',
        checked: false,
        enabled: true,
      },
      {
        title: '─────────────',
        tooltip: '',
        checked: false,
        enabled: false,
      },
      {
        title: 'Cancel',
        tooltip: '',
        checked: false,
        enabled: true,
      },
    ],
  })

  items.push({
    title: '─────────────',
    tooltip: '',
    checked: false,
    enabled: false,
  })

  if (options.browserStats !== undefined) {
    const { active, suspended } = options.browserStats
    items.push({
      title: 'Browser',
      tooltip: 'Brave tab suspension',
      checked: false,
      enabled: true,
      items: [
        {
          title: `Tabs: ${active} active / ${suspended} suspended`,
          tooltip: '',
          checked: false,
          enabled: false,
        },
        {
          title: 'Suspend Inactive Tabs Now',
          tooltip: 'Suspend all eligible tabs',
          checked: false,
          enabled: true,
        },
        {
          title: 'Restore All Tabs',
          tooltip: 'Restore all suspended tabs',
          checked: false,
          enabled: true,
        },
      ],
    })
    items.push({
      title: '─────────────',
      tooltip: '',
      checked: false,
      enabled: false,
    })
  }

  items.push({
    title: 'Status Window',
    tooltip: 'Open status window',
    checked: false,
    enabled: true,
  })

  items.push({
    title: 'Settings',
    tooltip: 'Open settings',
    checked: false,
    enabled: true,
  })

  items.push({
    title: '─────────────',
    tooltip: '',
    checked: false,
    enabled: false,
  })

  items.push({
    title: 'Quit AEGIS',
    tooltip: 'Exit AEGIS',
    checked: false,
    enabled: true,
  })

  return {
    icon: '',
    title: 'AEGIS',
    tooltip: 'AEGIS System Optimizer',
    items,
  }
}

export function findMenuItemBySeqId(
  menu: Menu,
  seqId: number
): { item: MenuItem; path: number[] } | undefined {
  function search(
    items: MenuItem[],
    path: number[]
  ): { item: MenuItem; path: number[] } | undefined {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item === undefined) continue

      if (path.length + i === seqId) {
        return { item, path: [...path, i] }
      }

      if (item.items !== undefined && item.items.length > 0) {
        const result = search(item.items, [...path, i])
        if (result !== undefined) {
          return result
        }
      }
    }
    return undefined
  }

  return search(menu.items, [])
}
