import { watch } from 'fs'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { getLogger } from '../logger/index.js'
import { LoadedProfile } from '../config/types.js'
import { loadProfileFromFile } from './loader.js'

export class ProfileRegistry {
  private profilesDir: string
  private profiles = new Map<string, LoadedProfile>()
  private watcher: ReturnType<typeof watch> | null = null
  private updateCallback:
    | ((name: string, profile: LoadedProfile) => void)
    | null = null
  private removeCallback: ((name: string) => void) | null = null
  private logger = getLogger()

  constructor(profilesDir: string) {
    this.profilesDir = profilesDir
  }

  async load(): Promise<void> {
    try {
      const files = await readdir(this.profilesDir)
      const yamlFiles = files.filter(
        (f) => f.endsWith('.yaml') || f.endsWith('.yml')
      )

      for (const file of yamlFiles) {
        const filePath = join(this.profilesDir, file)
        const profileName = file.replace(/\.(yaml|yml)$/, '')

        try {
          const profile = loadProfileFromFile(filePath)
          this.profiles.set(profileName, profile)
          this.logger.info('Loaded profile', { name: profileName })
        } catch (error) {
          this.logger.warn('Failed to load profile', {
            name: profileName,
            error,
          })
        }
      }
    } catch (error) {
      this.logger.error('Failed to read profiles directory', { error })
      throw error
    }
  }

  getProfile(name: string): LoadedProfile | undefined {
    return this.profiles.get(name)
  }

  getAllProfiles(): LoadedProfile[] {
    return Array.from(this.profiles.values())
  }

  getProfileOrder(order: string[]): LoadedProfile[] {
    const result: LoadedProfile[] = []
    for (const name of order) {
      const profile = this.profiles.get(name)
      if (profile !== undefined) {
        result.push(profile)
      }
    }
    return result
  }

  startWatcher(): void {
    if (this.watcher !== null) {
      return
    }

    this.watcher = watch(this.profilesDir, (eventType, filename) => {
      if (
        filename === null ||
        !(filename.endsWith('.yaml') ||
          filename.endsWith('.yml'))
      ) {
        return
      }

      const filePath = join(this.profilesDir, filename)
      const profileName = filename.replace(/\.(yaml|yml)$/, '')

      if (eventType === 'change' || eventType === 'rename') {
        try {
          const profile = loadProfileFromFile(filePath)
          this.profiles.set(profileName, profile)
          if (this.updateCallback !== null) {
            this.updateCallback(profileName, profile)
          }
          this.logger.info('Profile updated', { name: profileName })
        } catch (error) {
          this.logger.warn('Failed to reload profile', {
            name: profileName,
            error,
          })
        }
      }
    })
  }

  stopWatcher(): void {
    if (this.watcher !== null) {
      this.watcher.close()
      this.watcher = null
    }
  }

  onProfileUpdated(
    callback: (name: string, profile: LoadedProfile) => void
  ): void {
    this.updateCallback = callback
  }

  onProfileRemoved(callback: (name: string) => void): void {
    this.removeCallback = callback
  }
}
