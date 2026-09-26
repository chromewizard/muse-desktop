#!/usr/bin/env python3
"""Cut the 12 Beacon turnaround views out of a 4x3 reference sheet, key the white backdrop to alpha,
and emit the WebP atlas (192px cells) plus its base64 for enhancements/inspector-toggle.js (SHEET_URL).

    python3 build-sheet.py beacon-turnaround-arm-lift-12-keyframes-v1.png
"""
import base64, os, sys
import numpy as np
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else 'beacon-turnaround-arm-lift-12-keyframes-v1.png'
im = Image.open(src).convert('RGB'); W, H = im.size
a = np.asarray(im).astype(int); cols, rows = 4, 3; cw, ch = W / cols, H / rows
circles = []
for r in range(rows):
    for c in range(cols):
        x0, y0 = int(c * cw), int(r * ch); cell = a[y0:int(y0 + ch), x0:int(x0 + cw)]
        nonwhite = (cell.sum(axis=2) < 740); nonwhite[int(ch * 0.82):, :] = False   # ignore the label strip
        ys, xs = np.where(nonwhite); bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
        circles.append((x0 + (bx0 + bx1) / 2, y0 + (by0 + by1) / 2, max(bx1 - bx0, by1 - by0) / 2))
S = 192
out = Image.new('RGBA', (S * 4, S * 3), (0, 0, 0, 0))
yy, xx = np.mgrid[0:S, 0:S]; mask = ((xx - S / 2) ** 2 + (yy - S / 2) ** 2) <= (S / 2 - 6) ** 2
for i, (cx, cy, rad) in enumerate(circles):
    inner = rad * 0.94                                   # stay inside the drawn ring
    crop = im.crop((int(cx - inner), int(cy - inner), int(cx + inner), int(cy + inner))).resize((S, S), Image.LANCZOS)
    arr = np.asarray(crop).astype(float)
    dist = np.sqrt(((255 - arr) ** 2).sum(axis=2)); alpha = np.clip((dist - 10) / 22, 0, 1) * mask
    out.paste(Image.fromarray(np.dstack([arr, alpha * 255]).astype(np.uint8), 'RGBA'), ((i % 4) * S, (i // 4) * S))
out.save('beacon-turn-armlift.webp', quality=88, method=6)
b64 = base64.b64encode(open('beacon-turn-armlift.webp', 'rb').read()).decode()
open('beacon-turn-armlift.webp.b64', 'w').write(b64)
print('cells:', [(round(x), round(y), round(z)) for x, y, z in circles])
print('webp bytes:', os.path.getsize('beacon-turn-armlift.webp'), '| paste beacon-turn-armlift.webp.b64 into SHEET_URL')
