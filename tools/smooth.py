"""Smoother slow motion for a stretch of a winning run, from the real footage
only. Every frame asked for is a real frame with its real ball lifted out and
set down where a steadily moving ball would be at that moment, along the path
the ball really took. Nothing is drawn or guessed, so it still looks like the
game, and the recording's uneven frames (the ball moves 17px between some and
84px between others) no longer show.

    ~/bounce-puzzle-video/.venv-kokoro/bin/python tools/smooth.py VIDEO TIMES TRACK LEVEL SEEDX SEEDY OUTDIR

TIMES is a JSON list of clip times, one per frame wanted. Writes
OUTDIR/00000.jpg onward, one per time, and OUTDIR/pos.json with the ball's
centre in each. Also writes OUTDIR/check/NNN.jpg, eight frames at a time
cropped on one spot, to look over by eye.
"""
import json, pathlib, subprocess, sys

import numpy as np
from PIL import Image

video, times, track, level, sx, sy, out = sys.argv[1:]
times = json.loads(pathlib.Path(times).read_text())
t0, t1, sx, sy = np.floor(min(times) * 30) / 30, np.ceil(max(times) * 30) / 30, float(sx), float(sy)
out = pathlib.Path(out)
(out / "check").mkdir(parents=True, exist_ok=True)
W, H, R = 1080, 1920, 90          # R: px around the ball centre that hold the ball and its glow
ERASE = 100                       # px around the real ball that get patched over: the ball and its glow
FEATHER = 30                      # px at the patch edge that blend, so no ring shows where it ends
BALL = 48                         # px from the ball centre that are the ball itself, not trail
LIFT = 75                         # px around the ball centre lifted out and moved: the ball and its glow
PAD = 12                          # real frames either side, to patch from

raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t0 - PAD / 30:.4f}", "-t", f"{t1 - t0 + 2 * PAD / 30:.4f}", "-i", video,
                      "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
fs = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
base = t0 - PAD / 30

tr = json.loads(pathlib.Path(track).read_text())[level]
seen = [[tr["drop"], sx, sy]] + [b for b in tr["ball"] if b and b[0] > tr["drop"]]
def guess(t):
    """Where the tracker put the ball, to know where to look for it."""
    if t <= seen[0][0]:
        return seen[0][1], seen[0][2]
    for a, b in zip(seen, seen[1:]):
        if a[0] <= t <= b[0]:
            k = (t - a[0]) / (b[0] - a[0])
            return a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k
    return seen[-1][1], seen[-1][2]

yy, xx = np.mgrid[-R:R, -R:R]
soft = np.clip((ERASE - np.hypot(xx, yy)) / FEATHER, 0, 1)[..., None]
lift = np.clip((LIFT - np.hypot(xx, yy)) / 15, 0, 1)

def red(c):
    return (c[..., 0] > 190) & (c[..., 0] - c[..., 1] > 110) & (c[..., 0] - c[..., 2] > 90)

def shine(c):
    """The pale highlight on the ball, which red() misses."""
    return (c[..., 0] > 235) & (c[..., 1] > 125) & (c[..., 1] < 200)

def boxsum(m, h):
    """How many pixels of m fall in the (2h+1) square around each pixel."""
    s = np.pad(m.astype(np.int32), ((h + 1, h), (h + 1, h))).cumsum(0).cumsum(1)
    return s[2 * h + 1:, 2 * h + 1:] - s[:-2 * h - 1, 2 * h + 1:] - s[2 * h + 1:, :-2 * h - 1] + s[:-2 * h - 1, :-2 * h - 1]

def solid(m, h=15):
    """Pixels whose whole (2h+1) square is ball. Only the ball is that big, so
    trail dots beside it drop out and cannot pull its centre off."""
    return boxsum(m, h) >= 0.9 * (2 * h + 1) ** 2

# Where the ball actually is in each real frame: the centre of its solid part,
# found near where the tracker put it. The tracker can be a frame behind, and
# the ball moves up to about 110px a frame, so the search reaches well past it.
found = []
for i, f in enumerate(fs):
    px, py = guess(base + i / 30)
    x0, y0, x1, y1 = int(max(0, px - 220)), int(max(0, py - 220)), int(min(W, px + 220)), int(min(H, py + 220))
    c = f[y0:y1, x0:x1].astype(int)
    core = solid(red(c) | shine(c))
    if core.sum() > 20:
        ys, xs = np.nonzero(core)
        found.append((x0 + xs.mean(), y0 + ys.mean()))
    else:
        found.append(None)
for i in range(len(found)):               # fill the odd miss from its neighbours
    if found[i] is None:
        near = [found[j] for j in (i - 1, i + 1) if 0 <= j < len(found) and found[j]]
        found[i] = tuple(np.mean(near, 0)) if near else guess(base + i / 30)

def box(cx, cy):
    x, y = int(round(cx)) - R, int(round(cy)) - R
    return max(0, x), max(0, y), min(W, x + 2 * R), min(H, y + 2 * R), x, y

def clean(i):
    """Frame i with its ball replaced by the same spot from a frame where the
    ball has moved well away, earlier frames first (a later one has already
    drawn trail dots where the ball has not reached yet), then this frame's
    own trail dots put back."""
    f = fs[i].copy()
    bx, by = found[i]
    for j in list(range(i - 1, -1, -1)) + list(range(i + 1, len(fs))):
        ox, oy = found[j]
        if np.hypot(ox - bx, oy - by) > ERASE + BALL:
            x0, y0, x1, y1, x, y = box(bx, by)
            w = soft[y0 - y:y1 - y, x0 - x:x1 - x]
            own = fs[i][y0:y1, x0:x1]
            patched = f[y0:y1, x0:x1] * (1 - w) + fs[j][y0:y1, x0:x1] * w
            dots = red(own.astype(int)) & (np.hypot(xx, yy)[y0 - y:y1 - y, x0 - x:x1 - x] > BALL)
            dots = boxsum(dots, 2) > 0
            patched[dots] = own[dots]
            f[y0:y1, x0:x1] = patched.astype(np.uint8)
            return f
    return f

def move(i, target):
    """Frame i with its real ball (and glow) lifted out and set back down at target."""
    bg = clean(i).astype(float)
    ax, ay = found[i]
    mx, my = target
    x0, y0, x1, y1, x, y = box(ax, ay)
    piece = fs[i][y0:y1, x0:x1].astype(float)
    under = bg[y0:y1, x0:x1]
    # How much of each pixel is ball or glow: how far it is from the cleaned
    # background, inside the lifted circle. Only reddish pixels move (the ball,
    # its highlight and its red glow): anything else is a wall the glow lights
    # up, and moving it would leave a ghost of the wall.
    alpha = np.clip(np.abs(piece - under).max(2) / 60, 0, 1) * lift[y0 - y:y1 - y, x0 - x:x1 - x]
    alpha[piece[..., 0] < piece[..., 1] + 10] = 0
    # Pre-multiplied, so moving it by a fraction of a pixel blends cleanly.
    rgba = np.dstack([piece * alpha[..., None], alpha * 255]).clip(0, 255).astype(np.uint8)
    dx, dy = mx - ax, my - ay
    pw, ph = x1 - x0, y1 - y0
    moved = np.asarray(Image.fromarray(rgba, "RGBA").transform((pw, ph), Image.AFFINE, (1, 0, -(dx - int(np.floor(dx))), 0, 1, -(dy - int(np.floor(dy)))),
                                                               resample=Image.BILINEAR)).astype(float)
    ox, oy = x0 + int(np.floor(dx)), y0 + int(np.floor(dy))
    sx0, sy0 = max(0, -ox), max(0, -oy)
    ex, ey = min(pw, W - ox), min(ph, H - oy)
    a = moved[sy0:ey, sx0:ex, 3:] / 255
    region = bg[oy + sy0:oy + ey, ox + sx0:ox + ex]
    region[:] = region * (1 - a) + moved[sy0:ey, sx0:ex, :3]
    return bg.clip(0, 255).astype(np.uint8)

def save(img, path):
    Image.fromarray(img).save(path, quality=95)

# Where the ball should be in each real frame. The recording sometimes repeats
# a frame, so the ball stalls and then jumps twice as far: a repeat is treated
# as a missing frame, its ball set halfway between its neighbours.
want = list(found)
for i in range(1, len(found) - 1):
    if np.hypot(found[i][0] - found[i - 1][0], found[i][1] - found[i - 1][1]) < 3:
        want[i] = ((found[i - 1][0] + found[i + 1][0]) / 2, (found[i - 1][1] + found[i + 1][1]) / 2)
repeats = [i - PAD for i in range(len(found)) if want[i] != found[i]]

# Distance along the ball's real path at each real frame, and a steady pace
# through it: that distance against time, smoothed over the nearby frames.
WANT = np.array(want)
S = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(WANT, axis=0).T))])
T = base + np.arange(len(WANT)) / 30
def steady(t):
    w = np.exp(-((T - t) * 30 / 4.0) ** 2)
    A = np.stack([np.ones_like(T), T - t], 1) * w[:, None]
    return float(np.linalg.lstsq(A, S * w, rcond=None)[0][0])

cleaned, erase = {}, clean
def clean(i):                             # move() erases each real frame's ball once, not once per use
    if i not in cleaned:
        cleaned[i] = erase(i)
    return cleaned[i]

pos, made = [], []
for k, t in enumerate(times):
    goal = steady(t)
    i = int(np.clip(np.searchsorted(S, goal, side="right") - 1, 0, len(S) - 2))
    f = (goal - S[i]) / max(S[i + 1] - S[i], 1e-6)
    target = tuple(WANT[i] + (WANT[i + 1] - WANT[i]) * np.clip(f, 0, 1))
    img = move(i, target)                 # the real frame at or before this point, its ball set down here
    save(img, out / f"{k:05d}.jpg")
    pos.append(list(target))
    made.append((img, target))
    # Check sheet: eight frames in a row, cropped on the middle one's ball.
    if len(made) == 8 or k == len(times) - 1:
        cx, cy = made[len(made) // 2][1]
        cx, cy = int(np.clip(cx, 150, W - 150)), int(np.clip(cy, 150, H - 150))
        save(np.hstack([im[cy - 150:cy + 150, cx - 150:cx + 150] for im, _ in made]), out / "check" / f"{k // 8:03d}.jpg")
        made = []
(out / "pos.json").write_text(json.dumps(pos))
print(len(times), "frames, repeated real frames fixed at", repeats)
