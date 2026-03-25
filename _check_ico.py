from PIL import Image
img = Image.open(r"D:\Projects\AEGIS\src-tauri\icons\icon.ico")
print("sizes:", img.info.get("sizes"))
# seek through frames
i = 0
while True:
    try:
        img.seek(i)
        print(" ", img.size, "mode=", img.mode)
        i += 1
    except EOFError:
        break
print("total frames:", i)
# Also export 32px as PNG to verify visually
img.seek(0)
for j in range(i):
    img.seek(j)
    if img.size == (32, 32):
        img.save(r"D:\Projects\AEGIS\_preview_32.png", "PNG")
        print("Saved preview at 32x32")
        break
