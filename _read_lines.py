import sys
sys.stdout.reconfigure(encoding='utf-8')
# Search for onLaunchBrave in index.ts and tray types
for path in [r"D:\Dev\aegis\src\tray\index.ts", r"D:\Dev\aegis\src\tray\lifecycle.ts"]:
    lines = open(path, encoding="utf-8").readlines()
    for i, l in enumerate(lines):
        if 'onLaunchBrave' in l or 'LaunchBrave' in l:
            start = max(0, i-1)
            end = min(len(lines), i+3)
            print(f"\n{path}:{i+1}: {l.rstrip()}")
