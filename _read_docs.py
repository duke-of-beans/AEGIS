import sys
sys.stdout.reconfigure(encoding='utf-8')
for path in [r'D:\Dev\aegis\STATUS.md', r'D:\Dev\aegis\BACKLOG.md']:
    print(f"\n=== {path} ===")
    print(open(path, encoding='utf-8').read())
