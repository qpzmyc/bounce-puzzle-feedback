"""Ball positions and near-misses for winning runs, using the video repo's
ball and spike finders. Run with the video repo's numpy venv:

    ~/bounce-puzzle-video/.venv-kokoro/bin/python tools/track.py work/track.json

nearmiss.track picks whichever red spot is closest to a spike, which on some
levels is a red marker that never moves. This follows the spot that moves
instead: it starts from the candidate that has travelled furthest a third of a
second after the drop, then takes the candidate nearest the last position.

Writes, per level: the drop and landing times in win.mp4, the ball's centre on
the 1080x1920 frame every frame of the flight, and the near-miss windows.
"""
import json, pathlib, sys

import numpy as np

VID = pathlib.Path("/Users/Cheng_1/bounce-puzzle-video")
sys.path.insert(0, str(VID))
import nearmiss  # noqa: E402

LEVELS = sys.argv[2:] or ["Over or Under", "The Floor is Lava", "Back and Forth", "Stepping Down", "Spike Field", "Channel Hop"]
CUTOFF = 14         # px of clearance on the 540x960 frame that counts as a near-death
# World 6's spikes, which nearmiss.SPIKE has not measured: the green of
# Precision III's walls, read off its winning run (2026-10-28).
nearmiss.SPIKE.setdefault(6, (28, 188, 84))
out = {}
for e in json.load(open(VID / "footage/levels/manifest.json")):
    if e["build"] != "v2.0" or e["level"] not in LEVELS or not e["win"]:
        continue
    w = e["win"][-1]
    fs = nearmiss.frames(VID / w["file"], w["drop"], w["land"])
    world = e["world"] if isinstance(e["world"], int) else 1
    hz = nearmiss.spikes(fs[0], world)
    scenery = nearmiss.hazard_mask(fs[0], fs[-1])
    cands = [nearmiss.balls(f, scenery) for f in fs]
    # A red spot sitting in the same place for over a third of the flight is
    # scenery, never the ball.
    seen = {}
    for c in cands:
        for p in {(x // 4, y // 4) for x, y in c}:
            seen[p] = seen.get(p, 0) + 1
    fixed = [p for p, n in seen.items() if n > len(fs) / 3]
    cands = [[c for c in cs if all(abs(c[0] // 4 - p[0]) > 2 or abs(c[1] // 4 - p[1]) > 2 for p in fixed)] for cs in cands]
    k = min(10, len(fs) - 1)
    start = [np.array(p) for p in cands[0]] or [np.array((0, 0))]
    pos = max(cands[k], key=lambda p: min(np.hypot(*(np.array(p) - s)) for s in start)) if cands[k] else None
    path = [None] * len(fs)
    for rng in (range(k, len(fs)), range(k - 1, -1, -1)):
        last = pos
        for i in rng:
            if last is not None and cands[i]:
                p = min(cands[i], key=lambda c: np.hypot(c[0] - last[0], c[1] - last[1]))
                if np.hypot(p[0] - last[0], p[1] - last[1]) < 120:
                    path[i] = last = p
    ys, xs = np.nonzero(hz)
    tr = [(i / nearmiss.FPS, p, float(np.sqrt((xs - p[0]) ** 2 + (ys - p[1]) ** 2).min()) - nearmiss.BALL_R if len(xs) else 999.0)
          if p else None for i, p in enumerate(path)]
    found = nearmiss.passes(tr, cutoff=CUTOFF)
    out[e["level"]] = {
        "file": w["file"], "drop": w["drop"], "land": w["land"], "world": e["world"],
        "ball": [[round(w["drop"] + x[0], 3), x[1][0] * 2, x[1][1] * 2] if x else None for x in tr],
        "near": [{"t": round(w["drop"] + n["t"], 2), "start": round(w["drop"] + n["start"], 2),
                  "end": round(w["drop"] + n["end"], 2), "clearance": round(n["clearance"], 1)} for n in found],
    }
    print(e["level"], "flight", round(w["land"] - w["drop"], 1), "s, start", path[0] and (path[0][0] * 2, path[0][1] * 2),
          "near:", [(n["t"], n["clearance"]) for n in out[e["level"]]["near"]],
          "tracked", sum(1 for p in path if p), "of", len(path))
pathlib.Path(sys.argv[1]).write_text(json.dumps(out))
