"""Render the seamless 8-second loops and the YouTube cover.

    python3 render_loop.py            # out/loop_h.mp4, out/loop_v.mp4, cover.png
    python3 render_loop.py cover      # only the cover
"""
import os
import subprocess
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import scene

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")

_sc = None


def _init(w, h, vertical):
    global _sc
    _sc = scene.Scene(w, h, vertical)


def _frame(f):
    return np.asarray(_sc.frame(f), np.uint8).tobytes()


def render(w, h, vertical, path, workers=4):
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{w}x{h}", "-r", str(scene.FPS), "-i", "-",
           "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-maxrate", "6M", "-bufsize", "12M", "-tune", "grain", "-pix_fmt", "yuv420p",
           "-g", str(scene.NFRAMES), "-movflags", "+faststart", path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool(workers, _init, (w, h, vertical)) as pool:
        for i, buf in enumerate(pool.imap(_frame, range(scene.NFRAMES), chunksize=4)):
            p.stdin.write(buf)
            if i % 40 == 0:
                print(f"{os.path.basename(path)}: {i}/{scene.NFRAMES}", flush=True)
    p.stdin.close()
    p.wait()


def cover(path):
    """1280x720 thumbnail: frame of the loop + big title."""
    sc = scene.Scene(1920, 1080)
    im = sc.frame(12).convert("RGB")
    W, H = im.size
    d = ImageDraw.Draw(im, "RGBA")
    ft = scene.font(scene.F_TITLE, 150)
    fs = scene.font(scene.F_NARROW, 78)
    # title with neon glow
    glow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.text((W // 2, 150), "ДИСКОТЕКА 1986", font=ft, anchor="mm", fill=(255, 60, 170, 255))
    glow = glow.filter(ImageFilter.GaussianBlur(18))
    im.paste(glow, (0, 0), glow)
    im.paste(glow, (0, 0), glow)
    d = ImageDraw.Draw(im, "RGBA")
    d.text((W // 2 + 5, 155), "ДИСКОТЕКА 1986", font=ft, anchor="mm", fill=(40, 10, 60, 255))
    d.text((W // 2, 150), "ДИСКОТЕКА 1986", font=ft, anchor="mm", fill=(255, 236, 250, 255))
    # subtitle plate
    sub = "кассета, которой не было"
    b = d.textbbox((W // 2, 272), sub, font=fs, anchor="mm")
    d.rounded_rectangle([b[0] - 30, b[1] - 14, b[2] + 30, b[3] + 18], radius=16, fill=(20, 16, 40, 200))
    d.text((W // 2, 272), sub, font=fs, anchor="mm", fill=(120, 200, 255, 255))
    im.resize((1280, 720), Image.LANCZOS).save(path, optimize=True)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    cover(os.path.join(HERE, "cover.png"))
    if "cover" not in sys.argv[1:]:
        render(1920, 1080, False, os.path.join(OUT, "loop_h.mp4"))
        render(1080, 1920, True, os.path.join(OUT, "loop_v.mp4"))
    print("done")
