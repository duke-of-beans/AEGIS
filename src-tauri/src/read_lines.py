f = open('profiles.rs')
lines = f.readlines()
f.close()
for i in range(155, min(175, len(lines))):
    print(str(i+1) + ': ' + lines[i], end='')
