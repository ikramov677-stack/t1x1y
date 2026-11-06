"""Vertical 30-second Shorts: the chorus of a track over the vertical loop.

    python3 shorts.py                 # tracks 1, 5, 8, chorus found automatically
    python3 shorts.py 5:62.5 8        # track 5 from 62.5 s, track 8 auto

"Auto" = the loudest 30-second window between 20 % and 75 % of the song —
in Suno songs that is almost always a chorus. Check it by ear and pass the
start explicitly if it lands mid-phrase.

Needs out/norm/NN.wav (made by build_mix.py) and out/loop_v.mp4.
Writes out/short_NN.mp4 and shorts.txt (titles for upload).
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import scene

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
CFG = json.load(open(os.path.join(HERE, "tracks.json"), encoding="utf-8"))
LEN = 30.0
CAPTION = "Помнишь эту песню?"


def loudest_window(wav, length=LEN):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", wav, "-ac", "1", "-ar", "8000",
                          "-f", "f32le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32)
    sr = 8000
    hop = sr // 2
    e = np.array([np.mean(x[i:i + hop] ** 2) for i in range(0, len(x) - hop, hop)])
    n = int(length * 2)
    if len(e) <= n:
        return 0.0
    # 1) the loudest 10-second stretch inside 20–75 % of the song = the chorus body
    k = 20
    c = np.convolve(e, np.ones(k), "valid")
    lo, hi = int(len(e) * 0.20), int(len(e) * 0.75)
    hi = max(lo + 1, min(hi, len(c)))
    peak = lo + int(np.argmax(c[lo:hi]))
    # 2) walk back to where it starts: the biggest loudness jump in the 12 s before it
    sm = np.convolve(e, np.ones(4) / 4, "same")
    a, b = max(4, peak - 24), min(len(sm) - 4, peak + 4)
    if b > a:
        jump = sm[a + 2:b + 2] - sm[a - 2:b - 2]
        peak = a + int(np.argmax(jump))
    start = max(0.0, peak / 2.0 - 0.5)
    return min(start, max(0.0, len(x) / sr - length))


def caption_png(title, n, path):
    W, H = 1080, 1920
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f1 = scene.font(scene.F_TITLE, 82)
    f2 = scene.font(scene.F_NARROW, 64)
    f3 = scene.font(scene.F_NARROW, 44)
    y = 1530
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).text((W // 2, y), CAPTION, font=f1, anchor="mm", fill=(255, 60, 170, 255))
    glow = glow.filter(ImageFilter.GaussianBlur(14))
    im.alpha_composite(glow)
    im.alpha_composite(glow)
    d = ImageDraw.Draw(im)
    d.text((W // 2 + 4, y + 4), CAPTION, font=f1, anchor="mm", fill=(30, 8, 50, 255))
    d.text((W // 2, y), CAPTION, font=f1, anchor="mm", fill=(255, 238, 250, 255))
    t = f"«{title}»"
    b = d.textbbox((W // 2, y + 120), t, font=f2, anchor="mm")
    d.rounded_rectangle([b[0] - 28, b[1] - 14, b[2] + 28, b[3] + 18], radius=14, fill=(16, 12, 36, 210))
    d.text((W // 2, y + 120), t, font=f2, anchor="mm", fill=(130, 205, 255, 255))
    d.text((W // 2, y + 215), f"Дискотека 1986 · трек {n}", font=f3, anchor="mm", fill=(235, 225, 235, 230))
    im.save(path)


def make_short(n, start=None):
    t = next(x for x in CFG["tracks"] if x["n"] == n)
    wav = os.path.join(OUT, "norm", f"{n:02d}.wav")
    if not os.path.exists(wav):
        sys.exit(f"{wav} not found — run build_mix.py first")
    if start is None:
        start = t.get("short_start")
    if start is None:
        start = loudest_window(wav)
    png = os.path.join(OUT, f"short_{n:02d}_cap.png")
    caption_png(t["title"], n, png)
    dst = os.path.join(OUT, f"short_{n:02d}.mp4")
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-stream_loop", "-1", "-i", os.path.join(OUT, "loop_v.mp4"),
        "-loop", "1", "-i", png,
        "-ss", f"{start:.2f}", "-t", f"{LEN}", "-i", wav,
        "-filter_complex",
        f"[0:v][1:v]overlay=0:0:shortest=1,fade=t=in:d=0.4,fade=t=out:st={LEN - 0.8}:d=0.8[v];"
        f"[2:a]afade=t=in:d=0.6,afade=t=out:st={LEN - 2}:d=2[a]",
        "-map", "[v]", "-map", "[a]", "-t", f"{LEN}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", dst], check=True)
    os.remove(png)
    print(f"short {n:02d} «{t['title']}» from {start:.1f}s → {dst}")
    return t, start


def main():
    args = sys.argv[1:] or ["1", "5", "8"]
    meta = []
    for a in args:
        n, _, s = a.partition(":")
        t, start = make_short(int(n), float(s) if s else None)
        meta.append(f"Заголовок: Помнишь эту песню? 😉 «{t['title']}» · Дискотека 1986 #shorts\n"
                    f"Описание: Полная кассета — 40 минут ретро синт-попа на канале 🎶 (фрагмент с {start:.0f} с)\n"
                    f"Хештеги: #shorts #80е #ретро #синтпоп #ностальгия #aimusic\n")
    with open(os.path.join(HERE, "shorts.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(meta))


if __name__ == "__main__":
    main()
