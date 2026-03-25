f = open('D:/Projects/AEGIS/build.log', encoding='utf-8', errors='replace')
c = f.read()
f.close()
print('Log size:', len(c), 'chars')
# Print last 3000 chars
print(c[-3000:])
