#!/usr/bin/env python3
"""
AEGIS v2.0 — Tray Icon Generator
Generates 7 .ico files with shield shapes in profile colors.
Requires: pip install Pillow
"""

import os
from PIL import Image, ImageDraw

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

ICONS = [
    ("idle",          "#6b7280"),
    ("build-mode",    "#22c55e"),
    ("deep-research", "#3b82f6"),
    ("performance",   "#f59e0b"),
    ("wartime",       "#ef4444"),
    ("presentation",  "#a855f7"),
    ("warning",       "#f97316"),
]

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def draw_shield(size, color_hex):
    """
    Draw a filled shield shape on a transparent background.
    Shield: top is rounded rectangle, bottom tapers to a point.
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    r, g, b = hex_to_rgb(color_hex)
    color = (r, g, b, 255)
    
    w, h = size, size
    
    # Shield polygon points (normalized to size)
    # Shield shape: 
    #   Top-left corner, top-right corner (with slight rounding implied by polygon),
    #   sides go down, bottom tapers to center point
    pad = max(1, size // 8)
    
    # Outer shield path as polygon
    # Top: horizontal line from left to right at pad height
    # Sides: straight down to about 65% height
    # Bottom: taper to center point at bottom
    
    left = pad
    right = w - pad
    top = pad
    mid_h = int(h * 0.60)
    bottom_tip = h - pad
    center_x = w // 2
    
    # Shield polygon
    points = [
        (left, top),                    # top-left
        (right, top),                   # top-right
        (right, mid_h),                 # right side, mid height
        (center_x, bottom_tip),         # bottom tip
        (left, mid_h),                  # left side, mid height
    ]
    
    draw.polygon(points, fill=color)
    
    # Add a slight highlight/shade for depth (optional inner highlight)
    # Inner shield slightly lighter at top
    inner_pad = max(2, size // 6)
    inner_color = (
        min(255, r + 40),
        min(255, g + 40),
        min(255, b + 40),
        180
    )
    
    if size >= 16:
        inner_left = left + inner_pad
        inner_right = right - inner_pad
        inner_top = top + inner_pad
        inner_mid_h = int(mid_h * 0.75)
        inner_center_x = center_x
        inner_bottom = int(bottom_tip * 0.82)
        
        if inner_right > inner_left and inner_bottom > inner_top:
            inner_points = [
                (inner_left, inner_top),
                (inner_right, inner_top),
                (inner_right, inner_mid_h),
                (inner_center_x, inner_bottom),
                (inner_left, inner_mid_h),
            ]
            draw.polygon(inner_points, fill=inner_color)
    
    return img

def generate_ico(name, color_hex):
    """Generate a .ico file with 16x16 and 32x32 sizes."""
    sizes = [16, 32]
    images = []
    
    for size in sizes:
        img = draw_shield(size, color_hex)
        images.append(img)
    
    output_path = os.path.join(OUTPUT_DIR, f"{name}.ico")
    
    # Save as ICO with multiple sizes
    images[0].save(
        output_path,
        format='ICO',
        sizes=[(s, s) for s in sizes],
        append_images=images[1:]
    )
    
    print(f"Generated: {output_path}")
    return output_path

def main():
    print(f"Generating AEGIS tray icons in: {OUTPUT_DIR}")
    
    for name, color in ICONS:
        try:
            generate_ico(name, color)
        except Exception as e:
            print(f"ERROR generating {name}.ico: {e}")
            raise
    
    print(f"\nDone! Generated {len(ICONS)} icon files.")
    
    # Verify all files exist
    missing = []
    for name, _ in ICONS:
        path = os.path.join(OUTPUT_DIR, f"{name}.ico")
        if not os.path.exists(path):
            missing.append(name)
    
    if missing:
        print(f"WARNING: Missing icons: {missing}")
    else:
        print("All icons verified OK.")

if __name__ == "__main__":
    main()
