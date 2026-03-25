import re

with open('profiles.rs', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix sysinfo 0.33: ::new() -> ::nothing() for RefreshKind and ProcessRefreshKind
content = content.replace('RefreshKind::new()', 'RefreshKind::nothing()')
content = content.replace('ProcessRefreshKind::new()', 'ProcessRefreshKind::nothing()')

with open('profiles.rs', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed profiles.rs")

# Verify
with open('profiles.rs', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if 'RefreshKind' in line:
            print(f"  {i}: {line.rstrip()}")
