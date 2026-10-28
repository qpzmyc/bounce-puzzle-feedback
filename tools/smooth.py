"""Smooth slow motion for a stretch of a winning run, without the smearing
motion interpolation gives a fast ball: the ball is lifted out of each real
frame and redrawn, sharp, wherever the tracked path puts it in between.

    ~/bounce-puzzle-video/.venv-kokoro/bin/python tools/smooth.py VIDEO T0 T1 FPS TRACK LEVEL SEEDX SEEDY OUTDIR

Writes OUTDIR/00000.jpg onward, FPS frames a second of clip time from T0 to T1.
"""
import json, pathlib, subprocess, sys

import numpy as np

video, t0, t1, fps, track, level, sx, sy, out = sys.argv[1:]
t0, t1, fps, sx, sy = float(t0), float(t1), int(fps), float(sx), float(sy)
out = pathlib.Path(out)
out.mkdir(parents=True, exist_ok=True)
W, H, R = 1080, 1920, 40          # R: px around the ball centre that hold the ball and its glow
PAD = 0.4                         # s of real frames either side, to patch from

raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t0 - PAD:.3f}", "-t", f"{t1 - t0 + 2 * PAD:.3f}", "-i", video,
                      "-vf", "fps=30", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
fs = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
base = t0 - PAD

tr = json.loads(pathlib.Path(track).read_text())[level]
seen = [[tr["drop"], sx, sy]] + [b for b in tr["ball"] if b and b[0] > tr["drop"]]
def ball(t):
    if t <= seen[0][0]:
        return seen[0][1], seen[0][2]
    for a, b in zip(seen, seen[1:]):
        if a[0] <= t <= b[0]:
            k = (t - a[0]) / (b[0] - a[0])
            return a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k
    return seen[-1][1], seen[-1][2]

yy, xx = np.mgrid[-R:R, -R:R]
disc = (xx ** 2 + yy ** 2) < R ** 2

# Where the ball actually is in each real frame: the red pixels near where the
# track expects it. The track's clock can be a frame off this one's, and the
# ball moves about 40px a frame, so it is found again here.
found = []
for i, f in enumerate(fs):
    px, py = ball(base + i / 30)
    x0, y0, x1, y1 = int(max(0, px - 140)), int(max(0, py - 140)), int(min(W, px + 140)), int(min(H, py + 140))
    c = f[y0:y1, x0:x1].astype(int)
    m = (c[..., 0] > 190) & (c[..., 0] - c[..., 1] > 110) & (c[..., 0] - c[..., 2] > 90)
    if m.sum() > 200:
        ys, xs = np.nonzero(m)
        # The ball is the dense disc; trail dots are small, so weight by how
        # many red neighbours each pixel has.
        k = np.array([m[max(0, y - 6):y + 7, max(0, x - 6):x + 7].sum() for y, x in zip(ys, xs)], float) ** 2
        found.append((x0 + (xs * k).sum() / k.sum(), y0 + (ys * k).sum() / k.sum()))
    else:
        found.append(None)
for i in range(len(found)):               # fill the odd miss from its neighbours
    if found[i] is None:
        near = [found[j] for j in (i - 1, i + 1) if 0 <= j < len(found) and found[j]]
        found[i] = tuple(np.mean(near, 0)) if near else ball(base + i / 30)

def ball(t):                              # from here on, the ball's place is what was found
    p = (t - base) * 30
    i = int(np.clip(np.floor(p), 0, len(found) - 2))
    k = min(1.0, max(0.0, p - i))
    return found[i][0] + (found[i + 1][0] - found[i][0]) * k, found[i][1] + (found[i + 1][1] - found[i][1]) * k

def box(cx, cy):
    x, y = int(round(cx)) - R, int(round(cy)) - R
    return max(0, x), max(0, y), min(W, x + 2 * R), min(H, y + 2 * R), x, y

def clean(i):
    """Frame i with its ball replaced by the same spot from a frame where the
    ball has moved well away."""
    f = fs[i].copy()
    t = base + i / 30
    bx, by = ball(t)
    for j in list(range(i + 6, len(fs))) + list(range(i - 6, -1, -1)):
        ox, oy = ball(base + j / 30)
        if np.hypot(ox - bx, oy - by) > 2.5 * R:
            x0, y0, x1, y1, x, y = box(bx, by)
            m = disc[y0 - y:y1 - y, x0 - x:x1 - x]
            f[y0:y1, x0:x1][m] = fs[j][y0:y1, x0:x1][m]
            return f
    return f

# The ball sprite and its alpha: from a real frame mid-stretch, against the
# same spot in that frame once cleaned.
mid = len(fs) // 2
bx, by = ball(base + mid / 30)
x0, y0, x1, y1, x, y = box(bx, by)
sprite = fs[mid][y0:y1, x0:x1].astype(float)
bg = clean(mid)[y0:y1, x0:x1].astype(float)
alpha = np.clip(np.abs(sprite - bg).max(2) / 120.0, 0, 1)[..., None] * disc[y0 - y:y1 - y, x0 - x:x1 - x][..., None]

cleaned = {}
n = round((t1 - t0) * fps)
for k in range(n):
    t = t0 + k / fps
    i = int((t - base) * 30)       # the real frame at or before t: its trail dots and scenery
    if i not in cleaned:
        cleaned[i] = clean(i)
    f = cleaned[i].astype(float)
    cx, cy = ball(t)
    a0, b0, a1, b1, ax, ay = box(cx, cy)
    s = sprite[b0 - ay:b1 - ay, a0 - ax:a1 - ax] if sprite.shape[:2] == (2 * R, 2 * R) else sprite
    al = alpha[b0 - ay:b1 - ay, a0 - ax:a1 - ax] if alpha.shape[:2] == (2 * R, 2 * R) else alpha
    region = f[b0:b1, a0:a1]
    hgt, wid = min(region.shape[0], s.shape[0]), min(region.shape[1], s.shape[1])
    region[:hgt, :wid] = region[:hgt, :wid] * (1 - al[:hgt, :wid]) + s[:hgt, :wid] * al[:hgt, :wid]
    p = subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-i", "-",
                        "-q:v", "2", str(out / f"{k:05d}.jpg")], input=f.clip(0, 255).astype(np.uint8).tobytes(), check=True)
print(n, "frames")
