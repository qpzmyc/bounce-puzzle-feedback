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


def nearmiss_zoom(name, level, seed, near, pre=0.6, post=0.5, slow=0.12, half=0.12, ease=0.3, zin=2.6, hi=240):
    """A winning run that slows down and zooms in on the ball through each
    near-death, then speeds up and pulls back out. near is the times of the
    close calls in the clip. Around each one, tools/smooth.py redraws the ball
    at `hi` fps, so the slow motion stays smooth and sharp."""
    tr = TRACK[level]
    ball = ball_path(tr, seed)
    a, b = tr["drop"] - pre, tr["land"] + post
    frames, src, t = [], [], a
    while t < b:
        d = min(abs(t - c) for c in near)
        k = max(0.0, min(1.0, (half + ease - d) / ease))    # 0 away from a close call, 1 inside it
        k = k * k * (3 - 2 * k)
        frames.append((1 + (zin - 1) * k, *ball(t)))
        src.append(t)
        t += (1 - (1 - slow) * k) / 30                      # slow motion eases in with the zoom
    # Every source frame as an image, at 30 fps away from the close calls and
    # interpolated to `hi` fps around them. Each output frame links to the
    # image its time falls on.
    tmp, seq = OUT / f"{name}-frames", OUT / f"{name}-seq"
    seq.mkdir(exist_ok=True)
    (tmp / "base").mkdir(parents=True, exist_ok=True)
    run(["-ss", f"{a:.3f}", "-to", f"{b:.3f}", "-i", str(VID / tr["file"]), "-vf", "fps=30", "-q:v", "2", str(tmp / "base/%05d.jpg")])
    base = sorted((tmp / "base").glob("*.jpg"))
    wins = []
    for j, c in enumerate(near):
        w0, w1 = c - half - ease, c + half + ease
        subprocess.run([str(VID / ".venv-kokoro/bin/python"), str(ROOT / "tools/smooth.py"), str(VID / tr["file"]),
                        f"{w0 - 0.2:.3f}", f"{w1 + 0.2:.3f}", str(hi), str(ROOT / "work/track-p3.json"), level,
                        str(seed[0]), str(seed[1]), str(tmp / f"hi{j}")], check=True, capture_output=True)
        wins.append((w0, w1, w0 - 0.2, sorted((tmp / f"hi{j}").glob("*.jpg"))))
    for i, s in enumerate(src):
        pick = base[min(len(base) - 1, round((s - a) * 30))]
        for w0, w1, origin, imgs in wins:
            if w0 <= s <= w1:
                pick = imgs[min(len(imgs) - 1, round((s - origin) * hi))]
        (seq / f"{i:05d}.jpg").symlink_to(pick)
    script = OUT / f"{name}.cmd"
    run(["-framerate", "30", "-i", str(seq / "%05d.jpg"), "-vf", crops(script, frames),
         "-an", *ENC, str(OUT / f"{name}.mp4")])
    script.unlink()
    subprocess.run(["trash", str(tmp), str(seq)], check=True)


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

nearmiss_zoom("nearmiss-zoom-precision-iii", "Precision III", (384, 820), (3.93,))
nearmiss("nearmiss-stepping-down", "Stepping Down", take=3)
nearmiss("nearmiss-back-and-forth", "Back and Forth")
nearmiss("nearmiss-over-or-under", "Over or Under")

zoom("zoom-floor-is-lava", "The Floor is Lava", (824, 414), over=1.1)
zoom("zoom-back-and-forth", "Back and Forth", (544, 544))

plain("control-over-or-under", LV / "over-or-under/win.mp4", 1.8, 7.2)
plain("story-freeze", VID / "hyperframes/renders/opt-hook-b-freeze.mp4", 0, 7, audio=True)
print("\n".join(sorted(p.name for p in OUT.glob("*.mp4"))))
