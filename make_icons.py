"""
AEGIS Icon Generator v4
Mark: two thick concentric cyan rings, four ascending knockout dots
along 225deg diagonal, red locked dot at center.
Background: transparent. Rings: #00e5ff. Center: #e8192c.
Knockouts: punched transparent through the rings.
"""
import os, struct, io, math
from PIL import Image, ImageDraw

# ── Brand colors ──────────────────────────────────────────────────────────────
CYAN  = (0,   229, 255, 255)   # #00e5ff
RED   = (232,  25,  44, 255)   # #e8192c
TRANS = (0,     0,   0,   0)   # fully transparent

# ── Mark geometry (designed at radius=1.0, scaled per size) ──────────────────
# Outer ring: r=0.78, stroke=0.28 → inner wall at 0.64
# Inner ring: r=0.44, stroke=0.28 → outer wall at 0.58, inner wall at 0.30
# Gap outer→inner: 0.64 - 0.58 = 0.06  (tight sliver)
# Red dot r=0.24, gap to inner wall: 0.30 - 0.24 = 0.06  (matching sliver)
# 225deg unit vector: (-0.7071, +0.7071)
# Dot distances from center (along 225deg ray): 0.30, 0.64, 0.98, 1.32
# Dot radii: 0.16, 0.13, 0.10, 0.07 (ascending toward center)
# Dot opacities: 0.90, 0.65, 0.38, 0.18 (ascending toward center)

OUTER_R      = 0.78
OUTER_SW     = 0.28
INNER_R      = 0.44
INNER_SW     = 0.28
RED_R        = 0.24

ANGLE_DEG    = 225
ANGLE_RAD    = math.radians(ANGLE_DEG)
DX           = math.cos(ANGLE_RAD)   # -0.7071
DY           = math.sin(ANGLE_RAD)   #  0.7071 (SVG y-flip, PIL y goes down = positive)

# (distance, radius, opacity) — ordered far→near
DOTS = [
    (1.32, 0.07, 0.18),
    (0.98, 0.10, 0.38),
    (0.64, 0.13, 0.65),
    (0.30, 0.16, 0.90),
]


def draw_mark(size: int) -> Image.Image:
    """Draw the AEGIS mark at the given pixel size. Returns RGBA image."""
    img  = Image.new("RGBA", (size, size), TRANS)
    draw = ImageDraw.Draw(img)

    # Coordinate helpers — center of canvas
    cx = size / 2
    cy = size / 2
    s  = size / 2  # scale factor: 1.0 unit = half the canvas

    def circle(draw_obj, cx, cy, r, fill=None, outline=None, width=1):
        x0 = cx - r
        y0 = cy - r
        x1 = cx + r
        y1 = cy + r
        draw_obj.ellipse([x0, y0, x1, y1], fill=fill, outline=outline, width=width)

    # Step 1: Draw outer ring (filled annulus via two circles)
    outer_outer_r = (OUTER_R + OUTER_SW / 2) * s
    outer_inner_r = (OUTER_R - OUTER_SW / 2) * s
    circle(draw, cx, cy, outer_outer_r, fill=CYAN)
    circle(draw, cx, cy, outer_inner_r, fill=TRANS)

    # Step 2: Draw inner ring
    inner_outer_r = (INNER_R + INNER_SW / 2) * s
    inner_inner_r = (INNER_R - INNER_SW / 2) * s
    circle(draw, cx, cy, inner_outer_r, fill=CYAN)
    circle(draw, cx, cy, inner_inner_r, fill=TRANS)

    # Step 3: Punch knockout dots — erase pixels to transparent
    # Must composite onto a fresh layer to avoid erasing the background
    knockout = Image.new("RGBA", (size, size), TRANS)
    kd = ImageDraw.Draw(knockout)

    for dist, r_norm, opacity in DOTS:
        dot_cx = cx + DX * dist * s
        dot_cy = cy + DY * dist * s
        dot_r  = r_norm * s
        # Solid circle in knockout layer — will erase with composite
        kd.ellipse(
            [dot_cx - dot_r, dot_cy - dot_r,
             dot_cx + dot_r, dot_cy + dot_r],
            fill=(0, 0, 0, int(255 * opacity))
        )

    # Apply knockout: where knockout is opaque, punch transparent into img
    # Use alpha_composite trick: invert knockout as mask
    r, g, b, a = img.split()
    ko_r, ko_g, ko_b, ko_a = knockout.split()
    # Subtract knockout alpha from ring alpha
    from PIL import ImageChops
    new_a = ImageChops.subtract(a, ko_a)
    img = Image.merge("RGBA", (r, g, b, new_a))

    # Step 4: Draw red locked dot at center (on top of everything)
    draw2 = ImageDraw.Draw(img)
    red_r = RED_R * s
    circle(draw2, cx, cy, red_r, fill=RED)

    return img


def pack_ico(sizes, out_path):
    """Build proper multi-resolution ICO via raw binary packing."""
    frames = []
    for sz in sizes:
        img = draw_mark(sz)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        frames.append(buf.getvalue())

    n = len(frames)
    header    = struct.pack("<HHH", 0, 1, n)
    dir_size  = n * 16
    offset    = 6 + dir_size
    directory = b""
    for sz, data in zip(sizes, frames):
        w = sz if sz < 256 else 0
        h = sz if sz < 256 else 0
        directory += struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(data), offset)
        offset += len(data)

    with open(out_path, "wb") as f:
        f.write(header)
        f.write(directory)
        for data in frames:
            f.write(data)


def make_png(size, out_path):
    draw_mark(size).save(out_path, "PNG")


# ── Output paths ──────────────────────────────────────────────────────────────
ICONS_DIR = r"D:\Projects\AEGIS\src-tauri\icons"
os.makedirs(ICONS_DIR, exist_ok=True)

print("\nGenerating AEGIS icons...\n")

print("icon.ico (16 24 32 48 64 128 256):")
pack_ico([16, 24, 32, 48, 64, 128, 256],
         os.path.join(ICONS_DIR, "icon.ico"))
print("  done")

print("\nTauri PNGs:")
for sz, fn in [(32,  "32x32.png"),
               (128, "128x128.png"),
               (256, "128x128@2x.png"),
               (512, "icon.png")]:
    make_png(sz, os.path.join(ICONS_DIR, fn))
    print(f"  {fn}")

print("\nWindows Store logos:")
for fn, sz in [("Square30x30Logo.png",  30),
               ("Square44x44Logo.png",  44),
               ("Square71x71Logo.png",  71),
               ("Square89x89Logo.png",  89),
               ("Square107x107Logo.png",107),
               ("Square142x142Logo.png",142),
               ("Square150x150Logo.png",150),
               ("Square284x284Logo.png",284),
               ("Square310x310Logo.png",310),
               ("StoreLogo.png",         50)]:
    make_png(sz, os.path.join(ICONS_DIR, fn))
    print(f"  {fn}")

# Save previews for review
print("\nSaving previews...")
for sz in [16, 32, 64, 128, 256]:
    p = os.path.join(ICONS_DIR, f"_preview_{sz}px.png")
    make_png(sz, p)
    print(f"  _preview_{sz}px.png")

print("\nDone.")
