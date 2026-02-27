// AEGIS v2.0 Build Release Script
// Orchestrates: clean → copy dist → copy assets → pkg → stamp VERSION

import { execSync } from 'child_process'
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
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

// 4. Copy scripts (PowerShell worker)
console.log('Copying PowerShell worker...')
copyFileSync('scripts/aegis-worker.ps1', 'release/scripts/aegis-worker.ps1')

// 5. Copy assets (HTA, icons)
console.log('Copying assets...')
cpSync('assets', 'release/assets', { recursive: true })

// 6. Copy default profiles
console.log('Copying default profiles...')
cpSync('profiles', 'release/profiles', { recursive: true })

// 7. Copy config template
console.log('Copying config template...')
copyFileSync('aegis-config.yaml', 'release/aegis-config.yaml')

// 8. Stamp VERSION file
writeFileSync('release/VERSION', VERSION)
writeFileSync('VERSION', VERSION)

// 9. Copy launcher scripts
if (existsSync('AEGIS-silent.vbs')) {
  copyFileSync('AEGIS-silent.vbs', 'release/AEGIS-silent.vbs')
}

// 10. pkg: bundle Node.js + dist into single AEGIS.exe
console.log('Bundling with pkg...')
try {
  execSync(
    `npx pkg dist/main.js --target node20-win-x64 --output release/AEGIS.exe`,
    { stdio: 'inherit' }
  )
} catch (err) {
  console.warn('WARNING: pkg bundling failed (expected in non-Windows CI). Skipping .exe generation.')
}

console.log(`\n✅ Release built: v${VERSION}`)
console.log(`   Output: release/`)