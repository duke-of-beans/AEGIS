import re

with open('manager.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove ESM-only fileURLToPath import
content = content.replace("import { fileURLToPath } from 'url'\n", "")

# Replace the import.meta.url block with __dirname (available in CommonJS)
old = '''      const __filename = fileURLToPath(import.meta.url)
      const __dirname = dirname(__filename)
      const seedPath = join(__dirname, 'seed.json')'''

new = '''      const seedPath = join(__dirname, 'seed.json')'''

content = content.replace(old, new)

# Also remove dirname from path import if it's no longer needed elsewhere
# Keep dirname — it's still imported, just won't cause errors

with open('manager.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed catalog/manager.ts")

# Verify no import.meta remains
if 'import.meta' in content:
    print("WARNING: import.meta still present!")
else:
    print("OK: no import.meta")
