import yaml from 'js-yaml'
import { readFileSync } from 'fs'
import { AegisConfig, aegisConfigSchema } from './types.js'

function expandEnvironmentVariables(value: string): string {
  return value.replace(/%([^%]+)%/g, (_match, envVar: unknown) => {
    const envKey = String(envVar)
    return process.env[envKey] ?? ''
  })
}

function expandConfigPaths(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return expandEnvironmentVariables(obj)
  }
  if (Array.isArray(obj)) {
    return obj.map(expandConfigPaths)
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = expandConfigPaths(value)
    }
    return result
  }
  return obj
}

export function loadConfig(configPath: string): AegisConfig {
  const content = readFileSync(configPath, 'utf-8')
  const parsed = yaml.load(content)

  const expanded = expandConfigPaths(parsed)

  const validated = aegisConfigSchema.parse(expanded)

  return validated
}
