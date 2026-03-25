import os
f = open('D:/Projects/AEGIS/build2.log', encoding='utf-8', errors='replace')
c = f.read()
f.close()
print('Log size:', len(c), 'chars')
if c:
    print(c[-2000:])
else:
    print('(empty)')
