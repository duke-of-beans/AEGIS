// AEGIS v2.1.0 Build Release Script
// Orchestrates: clean → copy dist → copy node_modules → copy assets → stamp VERSION

import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
const VERSION = pkg.version

console.log(`Building AEGIS v${VERSION}...`)

// 1. Clean and create release/
console.log('Cleaning release directory...')
rmSync('release', { recursive: true, force: true })
mkdirSync('release/dist', { recursive: true })
mkdirSync('release/scripts', { recursive: true })
mkdirSync('release/assets/icons', { recursive: true })
mkdirSync('release/profiles', { recursive: true })

// 2. Check dist exists
if (!existsSync('dist')) {
  console.error('ERROR: dist/ directory not found. Run npm run build:ts first.')
  process.exit(1)
}

// 3. Copy compiled dist
console.log('Copying compiled TypeScript...')
cpSync('dist', 'release/dist', { recursive: true })

// 3a. Copy non-TS assets that tsc doesn't copy (JSON data files)
if (existsSync('src/catalog/seed.json')) {
  mkdirSync('dist/catalog', { recursive: true })
  copyFileSync('src/catalog/seed.json', 'dist/catalog/seed.json')
  mkdirSync('release/dist/catalog', { recursive: true })
  copyFileSync('src/catalog/seed.json', 'release/dist/catalog/seed.json')
}

// 4. Copy node_modules (required for native modules like better-sqlite3, winston-daily-rotate-file)
console.log('Copying node_modules (production dependencies)...')
cpSync('node_modules', 'release/node_modules', { recursive: true })

// 5. Copy package.json (required for Node module resolution)
console.log('Copying package.json...')
copyFileSync('package.json', 'release/package.json')

// 6. Copy scripts (PowerShell worker + installer task scripts)
console.log('Copying scripts...')
copyFileSync('scripts/aegis-worker.ps1', 'release/scripts/aegis-worker.ps1')
if (existsSync('scripts/install-task.ps1')) {
  copyFileSync('scripts/install-task.ps1', 'release/scripts/install-task.ps1')
}
if (existsSync('scripts/remove-task.ps1')) {
  copyFileSync('scripts/remove-task.ps1', 'release/scripts/remove-task.ps1')
}

// 7. Copy assets (HTA, icons)
console.log('Copying assets...')
cpSync('assets', 'release/assets', { recursive: true })

// 8. Copy default profiles
console.log('Copying default profiles...')
cpSync('profiles', 'release/profiles', { recursive: true })

// 9. Copy config template
console.log('Copying config template...')
copyFileSync('aegis-config.yaml', 'release/aegis-config.yaml')

// 10. Stamp VERSION file
writeFileSync('release/VERSION', VERSION)
writeFileSync('VERSION', VERSION)

// 11. Copy launcher scripts
if (existsSync('AEGIS-silent.vbs')) {
  copyFileSync('AEGIS-silent.vbs', 'release/AEGIS-silent.vbs')
}
if (existsSync('AEGIS.cmd')) {
  copyFileSync('AEGIS.cmd', 'release/AEGIS.cmd')
}

console.log(`\n✅ Release built: v${VERSION}`)
console.log(`   Output: release/`)
console.log(`   Launch: node dist/main.js (or AEGIS.cmd / AEGIS-silent.vbs)`)
