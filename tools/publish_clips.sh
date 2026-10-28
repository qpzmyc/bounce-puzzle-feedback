#!/usr/bin/env bash
# Encodes the picked clips from work/ into clips/ at phone size, each with a
# poster frame. Run from the repo root after tools/hooks.py and the edits.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=clips
mkdir -p "$OUT"

enc() {   # source, name, poster time in seconds
  ffmpeg -v error -y -i "$1" -vf "scale=540:960:flags=lanczos" -c:v libx264 -crf 27 -preset slow \
    -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 96k "$OUT/$2.mp4"
  ffmpeg -v error -y -ss "$3" -i "$OUT/$2.mp4" -frames:v 1 -q:v 4 "$OUT/$2.jpg"
}

# Part 1: the six openings
enc work/hooks/counter-brand.mp4 hook-attempt 0.5
enc work/hooks/nearmiss-zoom-precision-iii.mp4 hook-nearmiss 0.3
enc work/hooks/pov-brand.mp4 hook-pov 0.5
enc work/hooks/zoom-floor-is-lava.mp4 hook-zoom 0.3
enc work/hooks/control-over-or-under.mp4 hook-plain 0.3
enc work/hooks/story-freeze.mp4 hook-story 0.5

# Part 2: three edits per game video type
for t in can-you-solve which-layout fails-then-win; do
  for k in a b c; do enc "work/edits/$t/$k.mp4" "edit-$t-$k" 1.0; done
done

# Part 3: story options
for c in 1-current 2-highlight 3-pill 4-editorial; do enc "work/cuts/story-opt-caption-$c.mp4" "caption-${c#*-}" 2.0; done
for h in a-slam b-freeze c-card; do enc "work/cuts/story-opt-hook-$h.mp4" "storyhook-${h#*-}" 0.8; done
for n in 125 135 145; do enc "work/cuts/narr-$n.mp4" "narration-$n" 2.0; done

du -sh "$OUT"
