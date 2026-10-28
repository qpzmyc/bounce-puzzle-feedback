"""Renders the game styles again with a different opening, on the same level
as work/formats/, for the editing-choice matchups. The pipeline seeds its
level draw with the output's file name, so keeping the name keeps the level.

    ~/bounce-puzzle-video/.venv-voice/bin/python tools/variants.py work/variants
"""
import pathlib, shutil, sys

VID = pathlib.Path("/Users/Cheng_1/bounce-puzzle-video")
sys.path.insert(0, str(VID))
import styles  # noqa: E402

OUT = pathlib.Path(sys.argv[1]).resolve()
INDEX = VID / "hyperframes/index.html"
saved = INDEX.read_text()
try:
    for style, opening in (("can-you-solve", "banner"), ("which-layout", "banner"), ("fails-then-win", "straight")):
        meta = styles.make(style, OUT / opening / f"{style}.mp4", levers={"opening": opening})
        print(style, opening, meta["level"], meta["seconds"])
finally:
    INDEX.write_text(saved)   # the render rewrites it, and the video repo has its own changes there
