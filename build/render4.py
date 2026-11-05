"""Short «На Венере день длиннее года» — soft watercolor look, procedurally painted.

Usage: python3 render4.py out.mp4            -> full video (no audio)
       python3 render4.py stills/x 3 12 ...   -> PNG stills at given seconds
       python3 render4.py --events out.json   -> chime event list for audio4.py
"""
import json
import math
import os
import random
import subprocess
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, "fonts", "Comfortaa-Bold.ttf")
_fonts = {}


def font(size):
    size = max(8, int(size))
    if size not in _fonts:
        _fonts[size] = ImageFont.truetype(FONT, size)
    return _fonts[size]


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def prog(t, t0, t1):
    return clamp((t - t0) / (t1 - t0))


def ease_out(x):
    return 1 - (1 - x) ** 3


def ease_io(x):
    return 3 * x * x - 2 * x * x * x


def lerp(a, b, u):
    return a + (b - a) * u


def lerp_col(c1, c2, u):
    return tuple(int(lerp(a, b, u)) for a, b in zip(c1, c2))


# ------------------------------------------------------------------ palette
PAPER = (241, 230, 208)
INK = (92, 64, 52)
CREAM = (250, 242, 222)
TERRA = (203, 104, 72)
TERRA_L = (240, 165, 120)
NIGHT = (58, 64, 98)
VENUS = (228, 176, 98)
VENUS_D = (196, 132, 70)
VENUS_L = (244, 210, 140)
SUN = (246, 196, 112)
EARTH = (122, 160, 196)
LAND = (150, 180, 126)
MERC = (176, 168, 160)

# ------------------------------------------------------------------ voice / timeline
LINES = [
    "На Венере день длиннее, чем год!",
    "Год — это один оборот вокруг Солнца.",
    "На Венере он длится 225 земных дней.",
    "А вокруг своей оси она поворачивается за 243 дня.",
    "Она вращается так медленно, что год заканчивается раньше, чем один оборот.",
    "А ещё Венера крутится в обратную сторону.",
    "Поэтому Солнце там встаёт на западе!",
    "Это самая горячая планета: около 460 градусов.",
    "Горячее даже Меркурия, хотя он ближе к Солнцу.",
    "Всё из-за плотной атмосферы, которая держит тепло, как одеяло.",
    "Подписывайтесь на «Факты за минуту»!",
]
# estimated pacing until the real voiceover arrives (~13 chars/s + breathing room)
SCENE_DUR = [max(3.2, len(s) / 13.0 + 1.2) for s in LINES]
SCENE_DUR[0] += 0.6
SCENE_DUR[-1] = 5.5
VO = []  # (start, dur, text) — speech intervals
_t = 0.0
for _s, _d in zip(LINES, SCENE_DUR):
    VO.append((_t + 0.3, _d - 0.9, _s))
    _t += _d
STARTS = [sum(SCENE_DUR[:k]) for k in range(len(SCENE_DUR))]
DUR = sum(SCENE_DUR)
XFADE = 0.45


def build_chunks():
    chunks = []
    for start, dur, line in VO:
        words, groups, cur = line.split(), [], []
        for w in words:
            if cur and len(" ".join(cur + [w])) > 22:
                groups.append(cur)
                cur = []
            cur.append(w)
        if cur:
            groups.append(cur)
        weights = [len(" ".join(g)) + 4 for g in groups]
        tt = start
        for g, wgt in zip(groups, weights):
            dt = dur * wgt / sum(weights)
            chunks.append((tt, tt + dt, " ".join(g)))
            tt += dt
    return chunks


CHUNKS = build_chunks()

# ------------------------------------------------------------------ paper & texture
_tex = None


def textures():
    global _tex
    if _tex is None:
        rng = np.random.default_rng(3)
        grain = rng.normal(0, 1, (H, W)).astype(np.float32)
        g = Image.fromarray(((grain * 18) + 128).clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
        low = rng.normal(0, 1, (H // 24, W // 24)).astype(np.float32)
        lo = Image.fromarray(((low * 40) + 128).clip(0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
        lo = lo.filter(ImageFilter.GaussianBlur(30))
        ga = np.asarray(g, np.float32) - 128
        la = np.asarray(lo, np.float32) - 128
        mult = (240 + ga * 0.35 + la * 0.30).clip(190, 255).astype(np.uint8)
        tex = Image.fromarray(np.stack([mult] * 3, -1))
        paper = Image.new("RGB", (W, H), PAPER)
        # vignette
        yy, xx = np.mgrid[0:H, 0:W]
        v = (((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.75)) ** 2)
        vig = (255 - (v * 55)).clip(170, 255).astype(np.uint8)
        vig = Image.fromarray(np.stack([vig] * 3, -1))
        _tex = (paper, ImageChops.multiply(tex, vig))
    return _tex


# ------------------------------------------------------------------ painting helpers
def wob_poly(cx, cy, rx, ry, seed, wob=0.025, n=72, boil=0):
    rnd = random.Random(seed * 97 + boil)
    ph = [rnd.uniform(0, 6.28) for _ in range(3)]
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        f = 1 + wob * (math.sin(3 * a + ph[0]) + 0.6 * math.sin(5 * a + ph[1]) + 0.4 * math.sin(9 * a + ph[2]))
        pts.append((cx + rx * f * math.cos(a), cy + ry * f * math.sin(a)))
    return pts


def wash(d, pts, col, alpha=215, edge=True):
    d.polygon(pts, fill=col + (alpha,))
    if edge:
        dk = tuple(int(c * 0.78) for c in col)
        d.line(pts + [pts[0]], fill=dk + (110,), width=5, joint="curve")


def blob(d, cx, cy, r, col, seed=1, alpha=215, wob=0.025, ry=None, t=0.0, edge=True):
    boil = int(t * 4) % 3
    wash(d, wob_poly(cx, cy, r, ry or r, seed, wob, boil=boil), col, alpha, edge)


def soft_glow(img, cx, cy, r, col, strength=1.0):
    g = Image.new("RGBA", (int(r * 4), int(r * 4)), (0, 0, 0, 0))
    gd = ImageDraw.Draw(g)
    gd.ellipse((r, r, r * 3, r * 3), fill=col + (int(150 * strength),))
    g = g.filter(ImageFilter.GaussianBlur(r * 0.45))
    img.paste(g, (int(cx - r * 2), int(cy - r * 2)), g)


def full_wash(d, col, t, seed=5):
    d.rectangle((0, 0, W, H), fill=col + (235,))
    rnd = random.Random(seed)
    for k in range(9):
        x, y, r = rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(200, 450)
        c = lerp_col(col, (255, 255, 255), rnd.uniform(0.05, 0.15)) if k % 2 else tuple(int(v * 0.88) for v in col)
        blob(d, x, y, r, c, seed=seed + k, alpha=60, wob=0.06, edge=False)


def stars(d, t, seed=9, n=46, region=(0, 0, W, 1450)):
    rnd = random.Random(seed)
    for k in range(n):
        x = rnd.uniform(region[0] + 30, region[2] - 30)
        y = rnd.uniform(region[1] + 30, region[3] - 30)
        r = rnd.uniform(5, 13)
        tw = 0.55 + 0.45 * math.sin(t * rnd.uniform(1.2, 2.5) + k)
        a = int(200 * tw)
        d.line([(x - r, y), (x + r, y)], fill=CREAM + (a,), width=3)
        d.line([(x, y - r), (x, y + r)], fill=CREAM + (a,), width=3)


def planet(img, cx, cy, r, t, spin=0.0, base=VENUS, dark=VENUS_D, light=VENUS_L, kind="venus", seed=2, glow=0.0):
    if r < 2:
        return
    if glow > 0:
        soft_glow(img, cx, cy, r * 1.15, light, glow)
    size = int(2 * r + 20)
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer, "RGBA")
    c = size / 2
    ld.ellipse((c - r, c - r, c + r, c + r), fill=base + (255,))
    rnd = random.Random(seed)
    if kind == "venus":
        for k in range(5):
            y = c - r + (k + 0.5) * 2 * r / 5
            col = light if k % 2 else dark
            pts = []
            for i in range(41):
                x = c - r * 1.2 + i * r * 2.4 / 40
                pts.append((x, y + 10 * math.sin((x / r) * 3 + spin * 2 * math.pi + k)))
            ld.line(pts, fill=col + (85,), width=int(r * 0.2))
        layer = layer.filter(ImageFilter.GaussianBlur(r * 0.09))
        ld = ImageDraw.Draw(layer, "RGBA")
    elif kind == "earth":
        for k in range(5):
            ax = rnd.uniform(-1.5, 1.5)
            x = c + ((ax + spin * 3.0 + 1.5) % 3.0 - 1.5) * r
            y = c + rnd.uniform(-0.6, 0.6) * r
            ld.ellipse((x - r * 0.35, y - r * 0.22, x + r * 0.35, y + r * 0.25), fill=LAND + (230,))
    else:  # mercury craters
        for k in range(7):
            x, y, rr = c + rnd.uniform(-0.6, 0.6) * r, c + rnd.uniform(-0.6, 0.6) * r, rnd.uniform(0.08, 0.2) * r
            ld.ellipse((x - rr, y - rr, x + rr, y + rr), fill=dark + (170,))
    # watercolor shading: darker crescent + highlight
    sh = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.ellipse((c - r * 0.75, c - r * 0.85, c + r * 1.3, c + r * 1.25), fill=(60, 40, 60, 0))
    sd.ellipse((c - r, c - r, c + r, c + r), fill=(70, 45, 70, 70))
    sd.ellipse((c - r * 1.25, c - r * 1.25, c + r * 0.65, c + r * 0.65), fill=(0, 0, 0, 0))
    sh = sh.filter(ImageFilter.GaussianBlur(r * 0.12))
    layer = Image.alpha_composite(layer, sh)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).polygon(wob_poly(c, c, r, r, seed, 0.012, boil=int(t * 4) % 3), fill=255)
    layer.putalpha(ImageChops.multiply(layer.getchannel("A"), mask))
    img.paste(layer, (int(cx - c), int(cy - c)), layer)
    d = ImageDraw.Draw(img, "RGBA")
    d.line(wob_poly(cx, cy, r, r, seed, 0.012, boil=int(t * 4) % 3) + [wob_poly(cx, cy, r, r, seed, 0.012, boil=int(t * 4) % 3)[0]],
           fill=tuple(int(v * 0.7) for v in dark) + (120,), width=4)


def sun(img, d, cx, cy, r, t, rays=True):
    soft_glow(img, cx, cy, r * 1.4, SUN, 0.9)
    d = ImageDraw.Draw(img, "RGBA")
    blob(d, cx, cy, r, SUN, seed=11, alpha=240, t=t)
    blob(d, cx - r * 0.2, cy - r * 0.2, r * 0.55, (250, 220, 150), seed=12, alpha=150, edge=False, t=t)
    if rays:
        for k in range(12):
            a = k / 12 * 2 * math.pi + t * 0.15
            r0, r1 = r * 1.2, r * (1.45 + 0.08 * math.sin(t * 2 + k))
            d.line([(cx + r0 * math.cos(a), cy + r0 * math.sin(a)), (cx + r1 * math.cos(a), cy + r1 * math.sin(a))],
                   fill=(232, 160, 80, 200), width=8)
    return d


def say(d, s, cx, cy, size, col=INK, alpha=255, u=1.0):
    if alpha <= 0 or u <= 0:
        return
    sz = size * lerp(0.92, 1.0, ease_out(u))
    d.text((cx, cy + 20 * (1 - ease_out(u))), s, font=font(sz), anchor="mm", fill=col + (int(alpha * clamp(u * 1.5)),))


def underline(d, cx, cy, w, u, col=TERRA, seed=1):
    if u <= 0:
        return
    rnd = random.Random(seed)
    ph = rnd.uniform(0, 6)
    n = 30
    pts = []
    for i in range(int(n * u) + 1):
        v = i / n
        pts.append((cx - w / 2 + w * v, cy + 6 * math.sin(v * 7 + ph)))
    if len(pts) > 1:
        d.line(pts, fill=col + (220,), width=9, joint="curve")


def title(d, lt, top, key, col_top=INK, col_key=TERRA, y=300, ksize=104, tsize=62, t0=0.15):
    u1 = prog(lt, t0, t0 + 0.6)
    u2 = prog(lt, t0 + 0.35, t0 + 0.95)
    if top:
        say(d, top, W / 2, y, tsize, col_top, u=u1)
    say(d, key, W / 2, y + (tsize + ksize) * 0.62 if top else y, ksize, col_key, u=u2)
    bb = d.textbbox((W / 2, 0), key, font=font(ksize), anchor="mm")
    underline(d, W / 2, (y + (tsize + ksize) * 0.62 if top else y) + ksize * 0.62, (bb[2] - bb[0]) * 1.05,
              prog(lt, t0 + 0.8, t0 + 1.5), col_key, seed=len(key))


def curved_arrow(d, cx, cy, r, a0, a1, col, width=12, ry=None):
    ry = ry or r
    n = 40
    pts = [(cx + r * math.cos(lerp(a0, a1, i / n)), cy + ry * math.sin(lerp(a0, a1, i / n))) for i in range(n + 1)]
    d.line(pts, fill=col + (230,), width=width, joint="curve")
    (x1, y1), (x0, y0) = pts[-1], pts[-3]
    ang = math.atan2(y1 - y0, x1 - x0)
    hl = width * 3
    d.polygon([(x1 + hl * 0.6 * math.cos(ang), y1 + hl * 0.6 * math.sin(ang)),
               (x1 + hl * math.cos(ang + 2.4), y1 + hl * math.sin(ang + 2.4)),
               (x1 + hl * math.cos(ang - 2.4), y1 + hl * math.sin(ang - 2.4))], fill=col + (240,))


# ------------------------------------------------------------------ scenes  (lt = local time, D = scene duration)
def s1_intro(img, d, lt, D, t):
    full_wash(d, NIGHT, t, seed=21)
    stars(d, t)
    r = 250 * lerp(0.92, 1.0, ease_out(prog(lt, 0, 1.2)))
    planet(img, W / 2, 860 + 10 * math.sin(t * 0.8), r, t, spin=t * 0.02, glow=1.0)
    d = ImageDraw.Draw(img, "RGBA")
    title(d, lt, "день длиннее, чем", "ГОД!", col_top=CREAM, col_key=TERRA_L, y=1290, ksize=130, t0=0.3)


def s2_orbit(img, d, lt, D, t):
    cx, cy, R = W / 2, 980, 360
    d.line(wob_poly(cx, cy, R, R * 0.92, 31, 0.006, n=120) + [wob_poly(cx, cy, R, R * 0.92, 31, 0.006, n=120)[0]],
           fill=INK + (90,), width=5)
    d = sun(img, d, cx, cy, 105, t)
    a = -math.pi / 2 + ease_io(prog(lt, 0.2, D)) * 2 * math.pi * 0.95
    # trail
    tr = [(cx + R * math.cos(-math.pi / 2 + (a + math.pi / 2) * i / 30), cy + R * 0.92 * math.sin(-math.pi / 2 + (a + math.pi / 2) * i / 30))
          for i in range(31)]
    if len(tr) > 1:
        d.line(tr, fill=TERRA + (160,), width=10, joint="curve")
    planet(img, cx + R * math.cos(a), cy + R * 0.92 * math.sin(a), 58, t, spin=t * 0.1, seed=3)
    d = ImageDraw.Draw(img, "RGBA")
    title(d, lt, "1 год =", "1 оборот", y=270, ksize=104)
    say(d, "вокруг Солнца", W / 2, 1450, 56, INK, u=prog(lt, 0.9, 1.5))


def s3_calendar(img, d, lt, D, t):
    planet(img, 830, 650, 210, t, spin=t * 0.02, glow=0.4)
    d = ImageDraw.Draw(img, "RGBA")
    cx, cy, w, h = W / 2, 1060, 400, 440
    cnt = int(lerp(1, 225, ease_out(prog(lt, 0.3, D - 0.6))))
    # pad
    wash(d, wob_poly(cx, cy + 12, w / 2, h / 2, 41, 0.01), (225, 210, 185), 230)
    d.rounded_rectangle((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), radius=26, fill=(250, 244, 230, 245), outline=INK + (120,), width=5)
    d.rounded_rectangle((cx - w / 2, cy - h / 2, cx + w / 2, cy - h / 2 + 110), radius=26, fill=TERRA + (225,))
    for k in range(5):
        x = cx - w / 2 + 60 + k * (w - 120) / 4
        d.ellipse((x - 12, cy - h / 2 - 22, x + 12, cy - h / 2 + 2), fill=INK + (200,))
    say(d, "день", cx, cy - h / 2 + 55, 46, CREAM)
    say(d, str(cnt), cx, cy + 60, 150, INK)
    # flying pages
    for k in range(8):
        ph = (lt * 2.2 + k / 8) % 1.0
        if lt < 0.3 + k * 0.05:
            continue
        px = cx + 40 + ph * 520 * (1 + 0.15 * (k % 3))
        py = cy - 40 - ph * 700 + 120 * math.sin(ph * 3 + k)
        ang = ph * 4 + k
        pw, phh = 150 * (1 - ph * 0.5), 170 * (1 - ph * 0.5)
        pts = [(-pw, -phh), (pw, -phh), (pw, phh), (-pw, phh)]
        pts = [(px + x * math.cos(ang) - y * math.sin(ang) * 0.6, py + x * math.sin(ang) * 0.6 + y * math.cos(ang)) for x, y in pts]
        d.polygon(pts, fill=(250, 244, 230, int(220 * (1 - ph))), outline=INK + (int(90 * (1 - ph)),))
    title(d, lt, "1 год на Венере", "225 дней", y=270, ksize=104)


def s4_spin(img, d, lt, D, t):
    full_wash(d, NIGHT, t, seed=44)
    stars(d, t, seed=12)
    cx, cy, r = W / 2, 960, 270
    planet(img, cx, cy, r, t, spin=lt * 0.08, glow=0.8)
    d = ImageDraw.Draw(img, "RGBA")
    a0 = math.pi * 0.15 + lt * 0.4
    curved_arrow(d, cx, cy, r + 70, a0, a0 + math.pi * 1.4 * ease_out(prog(lt, 0.2, 1.4)) + 0.01, TERRA_L, width=14, ry=(r + 70) * 0.35)
    title(d, lt, "оборот вокруг оси", "243 дня", col_top=CREAM, col_key=TERRA_L, y=270, ksize=110)


def snail(d, cx, cy, s, t):
    # body
    body = []
    for i in range(30):
        v = i / 29
        body.append((cx - 160 * s + v * 330 * s, cy - (35 * s) * math.sin(math.pi * v) ** 0.5 - 6 * s * math.sin(t * 1.5 + v * 4)))
    body += [(cx + 170 * s, cy + 18 * s), (cx - 170 * s, cy + 18 * s)]
    wash(d, body, (226, 204, 172), 235)
    # head & eye stalks
    hx, hy = cx + 150 * s, cy - 25 * s
    for k, dx in enumerate((-14, 18)):
        tip = (hx + dx * s + 8 * s * math.sin(t * 1.2 + k), hy - 85 * s)
        d.line([(hx + dx * 0.4 * s, hy), tip], fill=(200, 175, 140, 240), width=int(9 * s))
        d.ellipse((tip[0] - 10 * s, tip[1] - 10 * s, tip[0] + 10 * s, tip[1] + 10 * s), fill=INK + (230,))
    d.arc((hx - 14 * s, hy - 4 * s, hx + 20 * s, hy + 18 * s), 20, 160, fill=INK + (200,), width=max(2, int(4 * s)))
    # shell
    sx, sy, sr = cx - 30 * s, cy - 105 * s, 105 * s
    blob(d, sx, sy, sr, (214, 150, 128), seed=55, alpha=240, t=t)
    pts = []
    for i in range(80):
        a = i / 80 * 4.2 * math.pi
        rr = sr * 0.85 * (1 - i / 85)
        pts.append((sx + rr * math.cos(a + 0.5), sy + rr * math.sin(a + 0.5)))
    d.line(pts, fill=(150, 90, 80, 200), width=int(8 * s), joint="curve")


def s5_snail(img, d, lt, D, t):
    cx, cy, r = W / 2, 1320, 330
    planet(img, cx, cy, r, t, spin=t * 0.01, glow=0.3)
    d = ImageDraw.Draw(img, "RGBA")
    snail(d, cx + 20, cy - r - 10, 1.0, t)
    # bars: year vs rotation
    x0, maxw = 330, 520
    u = ease_out(prog(lt, 0.4, 2.2))
    for k, (lab, val, col) in enumerate((("год", 225, VENUS_D), ("оборот", 243, TERRA))):
        y = 560 + k * 120
        say(d, lab, x0 - 120, y, 46, INK, u=prog(lt, 0.2 + k * 0.2, 0.8 + k * 0.2))
        w = maxw * val / 243 * u
        if w > 4:
            pts = wob_poly(x0 + w / 2, y, w / 2, 34, 60 + k, 0.01)
            wash(d, pts, col, 220)
        say(d, str(int(val * u)), x0 + w + 70, y, 46, INK, u=u)
    if lt > 2.3:
        say(d, "год закончился!", x0 + maxw * 225 / 243 / 2, 470, 44, TERRA, u=prog(lt, 2.3, 2.9))
    title(d, lt, None, "так медленно…", y=280, ksize=96)


def s6_reverse(img, d, lt, D, t):
    for (cx, kind, base, dark, light, lab, sgn) in ((300, "earth", EARTH, (90, 120, 160), (190, 210, 230), "Земля", -1),
                                                   (780, "venus", VENUS, VENUS_D, VENUS_L, "Венера", 1)):
        cy, r = 980, 165
        planet(img, cx, cy, r, t, spin=sgn * lt * 0.12 if kind == "venus" else -lt * 0.12, base=base, dark=dark, light=light,
               kind=kind, seed=7 if kind == "earth" else 2)
        d = ImageDraw.Draw(img, "RGBA")
        u = ease_out(prog(lt, 0.4 + (0.6 if sgn > 0 else 0), 1.4 + (0.6 if sgn > 0 else 0)))
        col = (100, 140, 180) if kind == "earth" else TERRA
        if u > 0:
            if sgn < 0:
                curved_arrow(d, cx, cy, r + 50, math.pi * 0.2, math.pi * 0.2 - math.pi * 1.3 * u - 0.01, col, 12, ry=(r + 50) * 0.4)
            else:
                curved_arrow(d, cx, cy, r + 50, math.pi * 0.8, math.pi * 0.8 + math.pi * 1.3 * u + 0.01, col, 12, ry=(r + 50) * 0.4)
        say(d, lab, cx, cy + r + 110, 52, INK, u=prog(lt, 0.3, 0.9))
    title(d, lt, "Венера крутится", "наоборот", y=280, ksize=110)


def s7_west(img, d, lt, D, t):
    # warm dawn sky
    d.rectangle((0, 0, W, H), fill=(246, 214, 180, 230))
    blob(d, W * 0.3, 700, 420, (250, 196, 150), seed=71, alpha=90, wob=0.08, edge=False)
    sy = lerp(1330, 1040, ease_io(prog(lt, 0.0, D)))
    d = sun(img, d, 260, sy, 115, t, rays=True)
    # hills
    for k, (y0, col, amp) in enumerate(((1250, (222, 150, 96), 60), (1380, (200, 120, 78), 50), (1520, (170, 98, 70), 40))):
        pts = [(0, H)]
        for i in range(41):
            x = i * W / 40
            pts.append((x, y0 + amp * math.sin(x * 0.006 + k * 2) + 20 * math.sin(x * 0.02 + k)))
        pts.append((W, H))
        wash(d, pts, col, 240)
    for (rx, ry, rr) in ((180, 1460, 50), (880, 1430, 70), (640, 1520, 40)):
        blob(d, rx, ry, rr, (150, 90, 70), seed=int(rx), alpha=220, ry=rr * 0.6, t=t)
    # signpost pointing west (left) toward the rising sun
    px, py = 760, 1300
    d.line([(px, py), (px, py - 330)], fill=(120, 80, 60, 255), width=22)
    u = ease_out(prog(lt, 0.5, 1.2))
    sw = 300 * u
    if sw > 10:
        board = [(px + 40, py - 330), (px + 40 - sw, py - 330), (px - sw - 20, py - 285), (px + 40 - sw, py - 240), (px + 40, py - 240)]
        wash(d, board, (236, 210, 170), 250)
        say(d, "ЗАПАД", px + 40 - sw / 2 - 10, py - 285, 52, INK, u=prog(lt, 0.9, 1.4))
    title(d, lt, "Солнце встаёт", "на западе!", y=280, ksize=110)


def s8_hot(img, d, lt, D, t):
    d.rectangle((0, 0, W, H), fill=(240, 170, 110, 235))
    blob(d, W / 2, 600, 500, (250, 200, 140), seed=81, alpha=90, wob=0.08, edge=False)
    pts = [(0, H)] + [(i * W / 40, 1320 + 40 * math.sin(i * 0.5) + 15 * math.sin(i * 1.7)) for i in range(41)] + [(W, H)]
    wash(d, pts, (190, 92, 62), 245)
    for k in range(6):
        x = 120 + k * 170
        d.line([(x + 10 * math.sin(k), 1380 + k * 20), (x + 60, 1440 + k * 18), (x + 30, 1500 + k * 15)], fill=(120, 50, 40, 160), width=5)
    # heat waves
    for k in range(7):
        x0 = 110 + k * 150
        ph = (lt * 0.5 + k * 0.17) % 1.0
        ybase = 1250 - ph * 520
        a = int(170 * math.sin(ph * math.pi))
        wave = [(x0 + 22 * math.sin(i * 0.5 + t * 3 + k), ybase - i * 14) for i in range(14)]
        d.line(wave, fill=(255, 240, 210, a), width=7, joint="curve")
    # thermometer
    tx, ty = 880, 880
    d.rounded_rectangle((tx - 34, ty - 360, tx + 34, ty + 160), radius=34, fill=(250, 244, 230, 245), outline=INK + (160,), width=5)
    blob(d, tx, ty + 200, 70, (210, 70, 50), seed=88, alpha=250, t=t)
    lvl = ease_out(prog(lt, 0.3, 2.3))
    d.rounded_rectangle((tx - 16, lerp(ty + 160, ty - 330, lvl), tx + 16, ty + 180), radius=16, fill=(210, 70, 50, 250))
    temp = int(460 * lvl)
    say(d, f"{temp}°C", 420, 920, 150, (130, 40, 30), u=prog(lt, 0.3, 0.8))
    title(d, lt, "самая", "горячая планета", y=280, ksize=92)


def s9_row(img, d, lt, D, t):
    d = sun(img, d, -40, 960, 300, t, rays=True)
    mu = ease_out(prog(lt, 0.2, 0.8))
    vu = ease_out(prog(lt, 0.6, 1.2))
    planet(img, 430, 960, 52 * mu, t, base=MERC, dark=(130, 124, 118), light=(210, 205, 200), kind="mercury", seed=5)
    planet(img, 770, 960, 120 * vu, t, spin=t * 0.02, seed=2, glow=0.6 + 0.6 * (0.5 + 0.5 * math.sin(t * 3)) * prog(lt, 1.6, 2.2))
    d = ImageDraw.Draw(img, "RGBA")
    say(d, "Меркурий", 430, 1100, 46, INK, u=prog(lt, 0.4, 0.9))
    say(d, "~430°", 430, 1165, 52, (150, 110, 90), u=prog(lt, 1.2, 1.7))
    say(d, "Венера", 770, 1160, 50, INK, u=prog(lt, 0.8, 1.3))
    say(d, "~460°", 770, 1230, 64, TERRA, u=prog(lt, 1.6, 2.1))
    if lt > 2.0:
        u = prog(lt, 2.0, 2.6)
        d.line([(430, 860), (430, 860 - 120 * u)], fill=INK + (180,), width=6)
        say(d, "ближе к Солнцу", 430, 700, 40, INK, u=u)
    title(d, lt, "горячее даже", "Меркурия", y=280, ksize=110)


def s10_blanket(img, d, lt, D, t):
    cx, cy, r = W / 2, 990, 230
    planet(img, cx, cy, r, t, spin=t * 0.01, glow=0.4)
    d = ImageDraw.Draw(img, "RGBA")
    wrap = ease_io(prog(lt, 0.3, 2.4))
    # heat arrows bouncing under the clouds
    for k in range(6):
        a = k / 6 * 2 * math.pi + 0.3
        ph = (lt * 0.8 + k * 0.16) % 1.0
        rr = r + 20 + 70 * math.sin(ph * math.pi)
        x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
        d.ellipse((x - 12, y - 12, x + 12, y + 12), fill=(220, 90, 60, int(200 * wrap)))
    # cloud blanket: puffs around the planet
    n = 16
    for k in range(n):
        a = k / n * 2 * math.pi + 0.2 * math.sin(t * 0.4)
        rr = lerp(r + 260, r + 75, wrap)
        x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
        blob(d, x, y, lerp(40, 105, wrap), (244, 222, 150), seed=100 + k, alpha=int(lerp(80, 220, wrap)), t=t)
    for k in range(10):
        a = k / 10 * 2 * math.pi + 0.15
        x, y = cx + (r * 0.55) * math.cos(a), cy + (r * 0.55) * math.sin(a)
        blob(d, x, y, 70 * wrap, (248, 232, 170), seed=140 + k, alpha=int(55 * wrap), edge=False, t=t)
    title(d, lt, "атмосфера —", "как одеяло", y=280, ksize=110)


def s11_outro(img, d, lt, D, t):
    full_wash(d, NIGHT, t, seed=111)
    stars(d, t, seed=33, n=40, region=(0, 0, W, 1250))
    planet(img, 760, 560, 70, t, glow=1.4)
    d = ImageDraw.Draw(img, "RGBA")
    for k, (y0, col, amp) in enumerate(((1250, (88, 102, 120), 70), (1360, (70, 84, 100), 55), (1470, (55, 66, 82), 45))):
        pts = [(0, H)] + [(i * W / 40, y0 + amp * math.sin(i * 0.25 + k * 2)) for i in range(41)] + [(W, H)]
        wash(d, pts, col, 245)
    say(d, "Факты", W / 2, 860, 120, CREAM, u=prog(lt, 0.2, 0.8))
    say(d, "за минуту", W / 2, 990, 84, TERRA_L, u=prog(lt, 0.5, 1.1))
    u = ease_out(prog(lt, 1.0, 1.6))
    if u > 0:
        bw, bh = 300 * u, 70 * u
        pts = wob_poly(W / 2, 1150, bw, bh, 7, 0.01)
        wash(d, pts, TERRA, 240)
        say(d, "подписаться", W / 2, 1150, 52, CREAM, u=u)


SCENES = [s1_intro, s2_orbit, s3_calendar, s4_spin, s5_snail, s6_reverse, s7_west, s8_hot, s9_row, s10_blanket, s11_outro]


def scene_frame(k, t):
    tex_paper, _ = textures()
    img = tex_paper.copy()
    d = ImageDraw.Draw(img, "RGBA")
    lt = t - STARTS[k]
    SCENES[k](img, d, lt, SCENE_DUR[k], t)
    # slow Ken Burns push-in
    z = 1.0 + 0.035 * clamp(lt / SCENE_DUR[k], 0, 1.3)
    cw, ch = W / z, H / z
    x0, y0 = (W - cw) / 2, (H - ch) / 2
    return img.transform((W, H), Image.EXTENT, (x0, y0, x0 + cw, y0 + ch), Image.BILINEAR)


def draw_subs(d, t):
    for (a, b, s) in CHUNKS:
        if a <= t < b + 0.05:
            f = font(56)
            u = prog(t, a, a + 0.15)
            bb = d.textbbox((W / 2, 1650), s, font=f, anchor="mm")
            pts = wob_poly(W / 2, 1650, (bb[2] - bb[0]) / 2 + 48, 62, 3, 0.01)
            d.polygon(pts, fill=(250, 242, 222, int(215 * u)))
            d.text((W / 2, 1650), s, font=f, anchor="mm", fill=INK + (int(255 * u),))
            return


def render_frame(i):
    t = i / FPS
    k = max(j for j in range(len(STARTS)) if STARTS[j] <= t)
    img = scene_frame(k, t)
    # crossfade into the next scene
    if k + 1 < len(STARTS) and t > STARTS[k + 1] - XFADE:
        nxt = scene_frame(k + 1, t)
        img = Image.blend(img, nxt, ease_io(prog(t, STARTS[k + 1] - XFADE, STARTS[k + 1])))
    img = img.filter(ImageFilter.GaussianBlur(1.1))
    d = ImageDraw.Draw(img, "RGBA")
    draw_subs(d, t)
    _, tex = textures()
    img = ImageChops.multiply(img, tex)
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle((0, 0, W * t / DUR, 10), fill=TERRA + (200,))
    fade = max(1 - t / 0.4, 1 - (DUR - t) / 0.6, 0)
    if fade > 0:
        d.rectangle((0, 0, W, H), fill=(40, 30, 30, int(255 * clamp(fade))))
    return img.tobytes()


def events():
    # soft chimes at key numbers / reveals (scene-local offsets)
    ev = []
    for k, off in ((0, 1.0), (1, 1.0), (2, 1.0), (3, 1.0), (4, 2.3), (5, 1.0), (6, 1.0), (7, 0.8), (8, 1.6), (9, 1.0), (10, 1.0)):
        ev.append((STARTS[k] + off, "chime"))
    return ev


def main():
    if sys.argv[1] == "--events":
        json.dump({"events": events(), "dur": DUR}, open(sys.argv[2], "w"))
        return
    out = sys.argv[1]
    if sys.argv[2:]:
        for s in sys.argv[2:]:
            Image.frombytes("RGB", (W, H), render_frame(int(float(s) * FPS))).save(f"{out}_{s}.png")
        return
    n = int(DUR * FPS)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "19",
                           "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
    with Pool(4) as pool:
        for fr in pool.imap(render_frame, range(n), chunksize=6):
            ff.stdin.write(fr)
    ff.stdin.close()
    ff.wait()


if __name__ == "__main__":
    main()
