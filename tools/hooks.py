"""Cuts the keep-or-scroll hook clips from the game footage, several takes per
hook so Cheng can pick. Run tools/overlays.js for the text and tools/track.py
for the ball positions and near-misses first.

    python3 tools/hooks.py work/hooks
"""
import json, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
VID = pathlib.Path("/Users/Cheng_1/bounce-puzzle-video")
LV = VID / "footage/levels/v2.0"
OV = ROOT / "work/overlays"
TRACK = {**json.loads((ROOT / "work/track.json").read_text()), **json.loads((ROOT / "work/track-p3.json").read_text())}
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "work/hooks").resolve()
OUT.mkdir(parents=True, exist_ok=True)
ENC = ["-c:v", "libx264", "-crf", "24", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
SMALL = "scale=720:1280:flags=lanczos"


def run(args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def counter(name, src, start, end, png, hold=1.4, hit=0.28):
    """The attempt number slams in over the dimmed board with a flash and a
    shake, then the board lights up for the drop."""
    land = f"clip((t-0.1)/{hit - 0.1},0,1)"
    grow = f"(1+1.8*pow(1-{land},3))"
    shake = f"if(between(t,{hit},{hit + 0.32}),18*sin(t*150)*({hit + 0.32}-t)/0.32,0)"
    run(["-ss", str(start), "-to", str(end), "-i", str(src), "-loop", "1", "-t", str(hold), "-i", str(png),
         "-filter_complex",
         f"[1]format=rgba,scale=w='trunc(1080*{grow}/2)*2':h='trunc(1920*{grow}/2)*2':eval=frame[txt];"
         f"[0]drawbox=x=0:y=0:w=iw:h=ih:color=black@0.6:t=fill:enable='lt(t,{hold})'[dim];"
         f"[dim][txt]overlay=x='(W-w)/2':y='(H-h)/2':eof_action=pass:enable='between(t,0.1,{hold})'[c];"
         f"[c]drawbox=x=0:y=0:w=iw:h=ih:color=white@0.45:t=fill:enable='between(t,{hit},{hit + 0.07})',"
         f"scale=1124:1998,crop=1080:1920:x='22+{shake}':y='39+{shake}*0.7',{SMALL}",
         "-an", *ENC, str(OUT / f"{name}.mp4")])


def nearmiss(name, level, take=None, pre=1.0, post=0.8, slow=0.3, half=0.3):
    """A winning run at normal speed, slowed through each near-death."""
    tr = TRACK[level]
    near = sorted(n["t"] for n in tr["near"] if n["t"] - tr["drop"] > 0.3)[:take]
    a, b = tr["drop"] - pre, tr["land"] + post
    parts, t = [], a
    for c in near:
        s, e = max(t, c - half), min(b, c + half)
        if s > t:
            parts.append((t, s, 1))
        parts.append((s, e, slow))
        t = e
    parts.append((t, b, 1))
    chains = "".join(f"[0]trim={s:.3f}:{e:.3f},setpts=(PTS-STARTPTS)/{k},fps=30[p{i}];" for i, (s, e, k) in enumerate(parts))
    run(["-i", str(VID / tr["file"]), "-filter_complex",
         chains + "".join(f"[p{i}]" for i in range(len(parts))) + f"concat=n={len(parts)}:v=1:a=0,{SMALL}",
         "-an", *ENC, str(OUT / f"{name}.mp4")])


def ball_path(tr, seed):
    """The ball's centre at any time in the clip, between tracked frames by a
    straight line. seed is its resting place before the drop, read off a
    frame, since the tracker can miss it there."""
    seen = [[tr["drop"], *seed]] + [b for b in tr["ball"] if b and b[0] > tr["drop"]]
    def ball(t):
        if t <= seen[0][0]:
            return seen[0][1], seen[0][2]
        for a, b in zip(seen, seen[1:]):
            if a[0] <= t <= b[0]:
                k = (t - a[0]) / (b[0] - a[0])
                return a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k
        return seen[-1][1], seen[-1][2]
    return ball


def smooth_ball_path(tr, seed):
    """Like ball_path, but smooth enough for a zoomed-in camera to follow: the
    tracker's repeated positions (a missed or repeated frame) are dropped, and
    the rest are fitted with a parabola around each moment, which is the path
    a ball in flight takes anyway. Needs numpy."""
    import numpy as np
    seen = [[tr["drop"], *seed]] + [b for b in tr["ball"] if b and b[0] > tr["drop"]]
    P = np.array([seen[0]] + [p for q, p in zip(seen, seen[1:]) if (p[1], p[2]) != (q[1], q[2])], float)
    def ball(t):
        w = np.exp(-((P[:, 0] - t) * 30 / 4.0) ** 2)
        keep = w > 1e-3
        tt, ww = P[keep, 0] - t, w[keep]
        A = np.stack([np.ones_like(tt), tt, tt * tt], 1) * ww[:, None]
        coef = np.linalg.lstsq(A, P[keep, 1:] * ww[:, None], rcond=None)[0]
        return float(coef[0, 0]), float(coef[0, 1])
    return ball


def crops(script, frames):
    """Writes a sendcmd script that sets the crop for each output frame, from
    (zoom, ball x, ball y) per frame. The camera is smoothed so it doesn't
    jitter, and kept inside the frame."""
    cmds, sx, sy = [], frames[0][1], frames[0][2]
    for i, (z, bx, by) in enumerate(frames):
        sx, sy = sx * 0.75 + bx * 0.25, sy * 0.75 + by * 0.25
        w, h = round(1080 / z / 2) * 2, round(1920 / z / 2) * 2
        x, y = min(1080 - w, max(0, round(sx - w / 2))), min(1920 - h, max(0, round(sy - h / 2)))
        cmds.append(f"{i / 30:.4f} crop@z w {w}, crop@z h {h}, crop@z x {x}, crop@z y {y};")
    script.write_text("\n".join(cmds))
    return f"sendcmd=f='{script}',crop@z=w=1080:h=1920:x=0:y=0,scale=720:1280:flags=lanczos:eval=frame"


def zoom(name, level, seed, pre=0.6, post=1.0, hold=0.1, over=1.6, z0=3.0):
    """Starts tight on the ball and pulls back to the whole board, keeping the
    ball in the middle of the frame the whole way."""
    tr = TRACK[level]
    ball = ball_path(tr, seed)
    start, end = tr["drop"] - pre, tr["land"] + post
    frames = []
    for i in range(round((end - start) * 30)):
        t = start + i / 30
        p = min(1, max(0, (t - tr["drop"] - hold) / over))
        frames.append((z0 - (z0 - 1) * (1 - (1 - p) ** 3), *ball(t)))
    script = OUT / f"{name}.cmd"
    run(["-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", str(VID / tr["file"]), "-vf", crops(script, frames),
         "-an", *ENC, str(OUT / f"{name}.mp4")])
    script.unlink()


def camera(imgs, frames, out):
    """Renders one image per output frame, cropped to (zoom, ball x, ball y)
    and placed to a fraction of a pixel, so a slow zoom glides instead of
    stepping a pixel at a time. The path given must already be smooth; it is
    only kept inside the frame. Needs Pillow."""
    from PIL import Image
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "720x1280", "-r", "30",
                            "-i", "-", "-an", *ENC, str(out)], stdin=subprocess.PIPE)
    for img, (z, sx, sy) in zip(imgs, frames):
        w, h = 1080 / z, 1920 / z
        x, y = min(1080 - w, max(0, sx - w / 2)), min(1920 - h, max(0, sy - h / 2))
        enc.stdin.write(Image.open(img).convert("RGB").resize((720, 1280), Image.LANCZOS, box=(x, y, x + w, y + h)).tobytes())
    enc.stdin.close()
    enc.wait()


def nearmiss_zoom(name, level, seed, near, pre=0.6, post=0.5, slow=0.25, half=0.12, ease=0.3, after=0.0, ease_out=0.08, zin=2.6):
    """A winning run that slows down and zooms in on the ball through each
    near-death, then speeds up and pulls back out. near is the times of the
    close calls in the clip. half and ease set the slow-down before each one,
    after and ease_out the speed-up after it, kept short so the slow motion
    ends soon after the ball clears the gap. Through each slow-down,
    tools/smooth.py makes every frame from the real footage, the real ball
    moved to a steady pace. Run it with a Python that has numpy and Pillow."""
    tr = TRACK[level]
    ball = smooth_ball_path(tr, seed)
    a, b = tr["drop"] - pre, tr["land"] + post
    frames, src, t = [], [], a
    while t < b:
        k = 0.0                                             # 0 away from a close call, 1 inside it
        for c in near:
            lead, ramp = (half, ease) if t < c else (after, ease_out)
            k = max(k, min(1.0, (lead + ramp - abs(t - c)) / ramp))
        k = k * k * (3 - 2 * k)
        # The slow motion ends fast after the gap, but the camera eases back out
        # over at least half a second, so it never snaps to the whole board.
        z = 1 + (zin - 1) * k
        if frames:
            z = max(z, frames[-1][0] - (zin - 1) / 15)
        frames.append((z, *ball(t)))
        src.append(t)
        t += (1 - (1 - slow) * k) / 30                      # slow motion eases in with the zoom
    # Every real frame as an image, each output frame showing the one at or
    # before its time. Through each slow-down, tools/smooth.py's frames are
    # used instead.
    tmp = OUT / f"{name}-frames"
    (tmp / "base").mkdir(parents=True, exist_ok=True)
    run(["-ss", f"{a:.3f}", "-to", f"{b:.3f}", "-i", str(VID / tr["file"]), "-q:v", "2", str(tmp / "base/%05d.jpg")])
    base = sorted((tmp / "base").glob("*.jpg"))
    imgs = [base[min(len(base) - 1, int((s - a) * 30 + 1e-6))] for s in src]
    for j, c in enumerate(near):
        # Through the zoom-out too, which outlasts the slow motion, so the
        # camera never jumps between two ways of following the ball.
        w0, w1 = c - half - ease, c + after + ease_out + 0.7
        idx = [i for i, s in enumerate(src) if w0 <= s <= w1]
        times = tmp / f"times{j}.json"
        times.write_text(json.dumps([src[i] for i in idx]))
        subprocess.run([str(VID / ".venv-kokoro/bin/python"), str(ROOT / "tools/smooth.py"), str(VID / tr["file"]), str(times),
                        str(ROOT / "work/track-p3.json"), level, str(seed[0]), str(seed[1]), str(tmp / f"hi{j}")],
                       check=True, capture_output=True)
        pos = json.loads((tmp / f"hi{j}/pos.json").read_text())
        for n, i in enumerate(idx):
            imgs[i] = tmp / f"hi{j}/{n:05d}.jpg"
            # The camera stays on the ball shown, which moves at a steady pace.
            frames[i] = (frames[i][0], *pos[n])
    camera(imgs, frames, OUT / f"{name}.mp4")
    subprocess.run(["trash", str(tmp)], check=True)


def pov(name, src, start, end, png):
    """POV text over placing, through the drop."""
    run(["-ss", str(start), "-to", str(end), "-i", str(src), "-loop", "1", "-i", str(png),
         "-filter_complex", f"[0][1]overlay=0:0:shortest=1,{SMALL}",
         "-an", *ENC, str(OUT / f"{name}.mp4")])


def plain(name, src, start, end, audio=False):
    run(["-ss", str(start), "-to", str(end), "-i", str(src), "-vf", SMALL,
         *(["-c:a", "aac", "-b:a", "128k"] if audio else ["-an"]), *ENC, str(OUT / f"{name}.mp4")])


for style in ("caption", "amber", "brand"):
    counter(f"counter-{style}", LV / "the-vault-ii/attempts/78-win.mp4", 4.0, 10.0, OV / f"attempt-78-{style}.png")
    pov(f"pov-{style}", LV / "channel-hop/attempts/58-win.mp4", 6.0, 13.0, OV / f"pov-hour-{style}.png")

nearmiss_zoom("nearmiss-zoom-precision-iii", "Precision III", (384, 820), (3.90,))   # the ball clears the gap at 3.90 s
nearmiss("nearmiss-stepping-down", "Stepping Down", take=3)
nearmiss("nearmiss-back-and-forth", "Back and Forth")
nearmiss("nearmiss-over-or-under", "Over or Under")

zoom("zoom-floor-is-lava", "The Floor is Lava", (824, 414), over=1.1)
zoom("zoom-back-and-forth", "Back and Forth", (544, 544))

plain("control-over-or-under", LV / "over-or-under/win.mp4", 1.8, 7.2)
plain("story-freeze", VID / "hyperframes/renders/opt-hook-b-freeze.mp4", 0, 7, audio=True)
print("\n".join(sorted(p.name for p in OUT.glob("*.mp4"))))
