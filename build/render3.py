"""Part 3 short: «Банан — ягода, а клубника — нет». Reuses the drawing kit from render.py.

Usage: python3 render3.py out.mp4             -> full video (no audio)
       python3 render3.py stills/x 3 12 ...   -> PNG stills at given seconds
       python3 render3.py --events out.json   -> SFX event list for audio2.py
"""
import json
import math
import random
import subprocess
import sys
from multiprocessing import Pool

from PIL import Image, ImageDraw

import render as R
from render import W, H, FPS, clamp, prog, ease_out, ease_io, back_out, lerp, lerp_col, text, pop_text, bezier, beat

# ------------------------------------------------------------------ timeline / voice
# ElevenLabs voiceover (audio/el3.mp3): speech chunks in source time, grouped per scene.
VO_SRC = [
    [(0.00, 1.70, "Банан — это ягода."), (2.07, 3.40, "А клубника — нет!"), (3.85, 4.71, "Сейчас объясню.")],
    [(5.21, 9.58, "Для ботаников ягода — это мясистый плод из одной завязи цветка,"), (9.94, 11.51, "а семена находятся внутри.")],
    [(12.03, 13.71, "Банан подходит идеально."), (14.09, 15.63, "Видите чёрные точки внутри?"), (16.08, 17.72, "Это его крошечные семена."),
     (18.22, 21.50, "У диких бананов они крупные и твёрдые, как горошины.")],
    [(21.98, 23.95, "А у клубники семена снаружи!"), (24.33, 25.89, "И каждое такое «зёрнышко» —"), (26.17, 28.34, "это отдельный настоящий плод."),
     (28.82, 30.27, "А сочная красная часть —"), (30.57, 32.69, "просто разросшееся основание цветка.")],
    [(33.31, 36.76, "Зато ягодами по науке считаются помидор, огурец,"), (37.01, 38.90, "арбуз и даже авокадо!")],
    [(39.39, 41.44, "А малина, кстати, тоже не ягода.")],
    [(42.03, 43.86, "Подписывайтесь на «Факты за минуту»."), (44.15, 46.68, "Завтра новый удивительный факт!")],
]
CUT_SRC = [0, 4.96, 11.77, 21.74, 33.0, 39.145, 41.735, 46.68]
TARGET = [0.3, 5.2, 12.5, 22.6, 34.6, 41.4, 43.8]
R.VO = [(s0 + TARGET[k] - grp[0][0], s1 - s0, line) for k, grp in enumerate(VO_SRC) for (s0, s1, line) in grp]
R.CHUNKS = R.build_chunks()
DUR = 50.0
# new (voice-paced) time -> scene clock: (new_start, new_end, old_start), 1x speed
TIMEMAP = [(0, 5, 0), (5, 7.5, 5), (7.5, 12.3, 8.7), (12.3, 17.8, 15.3), (17.8, 22.4, 20.4), (22.4, 34.4, 25.0),
           (34.4, 41.2, 38.0), (41.2, 43.6, 50.0), (43.6, 50.01, 53.0)]
CUTS = (5, 12.3, 22.4, 34.4, 41.2, 43.6)


def scene_time(t):
    for n0, n1, o0 in TIMEMAP:
        if n0 <= t < n1:
            return o0 + (t - n0)
    return TIMEMAP[-1][2] + (t - TIMEMAP[-1][0])


def to_new(ot):
    for n0, n1, o0 in TIMEMAP:
        if o0 <= ot < o0 + (n1 - n0):
            return n0 + (ot - o0)
    return None


YEL = (255, 214, 64)
GREEN_OK = (60, 200, 90)
RED_NO = (235, 50, 60)
BANANA = (255, 216, 60)
BANANA_D = (190, 140, 20)
STRAW = (232, 40, 60)
STRAW_D = (150, 15, 35)
LEAF = (60, 170, 70)
LEAF_D = (30, 110, 45)

# ------------------------------------------------------------------ background
_rng = random.Random(11)
SPARKS = [(_rng.uniform(0, W), _rng.uniform(0, H), _rng.uniform(6, 16), _rng.uniform(0, 6.28), _rng.uniform(15, 45)) for _ in range(40)]
BG3 = None


def make_bg():
    bg = Image.new("RGB", (W, H))
    px = bg.load()
    top, bot = (92, 40, 140), (24, 14, 60)
    for y in range(H):
        c = lerp_col(top, bot, (y / H) ** 0.9)
        for x in range(W):
            px[x, y] = c
    return bg


def draw_bg_fx(d, t):
    cx, cy = W / 2, 950
    n = 18
    for k in range(n):
        a0 = (k / n) * 2 * math.pi + t * 0.15
        a1 = a0 + math.pi / n
        L = 1600
        d.polygon([(cx, cy), (cx + L * math.cos(a0), cy + L * math.sin(a0)), (cx + L * math.cos(a1), cy + L * math.sin(a1))],
                  fill=(255, 255, 255, 10))
    for (x0, y0, r, ph, sp) in SPARKS:
        y = (y0 - t * sp) % (H + 40) - 20
        tw = 0.5 + 0.5 * math.sin(t * 3 + ph)
        rr = r * (0.5 + 0.5 * tw)
        a = int(60 + 120 * tw)
        d.polygon([(x0, y - rr), (x0 + rr * 0.3, y - rr * 0.3), (x0 + rr, y), (x0 + rr * 0.3, y + rr * 0.3), (x0, y + rr),
                   (x0 - rr * 0.3, y + rr * 0.3), (x0 - rr, y), (x0 - rr * 0.3, y - rr * 0.3)], fill=(255, 240, 200, a))


# ------------------------------------------------------------------ primitives
def xf(pts, cx, cy, s, ang=0.0):
    ca, sa = math.cos(ang), math.sin(ang)
    return [(cx + (x * ca - y * sa) * s, cy + (x * sa + y * ca) * s) for x, y in pts]


def poly_ellipse(cx, cy, rx, ry, ang=0.0, n=28):
    pts = [(rx * math.cos(2 * math.pi * k / n), ry * math.sin(2 * math.pi * k / n)) for k in range(n)]
    return xf(pts, cx, cy, 1.0, ang)


def face(d, cx, cy, s, t, mood="happy", look=(0, 0)):
    blink = (t % 3.3) < 0.12
    for sx in (-1, 1):
        ex, ey = cx + sx * 34 * s, cy
        if blink:
            d.line([(ex - 16 * s, ey), (ex + 16 * s, ey)], fill=(40, 20, 20), width=max(2, int(6 * s)))
            continue
        d.ellipse((ex - 20 * s, ey - 24 * s, ex + 20 * s, ey + 24 * s), fill=(255, 255, 255), outline=(40, 20, 20), width=max(2, int(4 * s)))
        px, py = ex + look[0] * 7 * s, ey + look[1] * 8 * s
        d.ellipse((px - 10 * s, py - 12 * s, px + 10 * s, py + 12 * s), fill=(30, 20, 30))
        d.ellipse((px - 7 * s, py - 10 * s, px - 1 * s, py - 4 * s), fill=(255, 255, 255))
    my = cy + 40 * s
    if mood == "happy":
        d.arc((cx - 24 * s, my - 22 * s, cx + 24 * s, my + 14 * s), 20, 160, fill=(80, 20, 20), width=max(2, int(6 * s)))
    elif mood == "shock":
        d.ellipse((cx - 13 * s, my - 10 * s, cx + 13 * s, my + 20 * s), fill=(80, 20, 20))
    else:  # sad
        d.arc((cx - 22 * s, my, cx + 22 * s, my + 30 * s), 200, 340, fill=(80, 20, 20), width=max(2, int(6 * s)))


def banana(d, cx, cy, s, ang=0.0, t=0.0, mood=None):
    top, bot = [], []
    for k in range(31):
        u = -1 + 2 * k / 30
        c = 70 * u * u
        w = 62 * (1 - u * u) ** 0.55 + 4
        top.append((230 * u, c - w))
        bot.append((230 * u, c + w * 0.85))
    body = xf(top + bot[::-1], cx, cy, s, ang)
    d.polygon(body, fill=BANANA, outline=BANANA_D, width=max(2, int(6 * s)))
    # ridge line
    d.line(xf([(230 * (-1 + 2 * k / 20), 70 * (-1 + 2 * k / 20) ** 2 - 12) for k in range(3, 18)], cx, cy, s, ang),
           fill=(235, 190, 40), width=max(2, int(6 * s)))
    # stem and tip
    d.polygon(xf([(222, 40), (262, -10), (282, 0), (244, 56)], cx, cy, s, ang), fill=(120, 90, 30))
    tx, ty = xf([(-232, 66)], cx, cy, s, ang)[0]
    d.ellipse((tx - 12 * s, ty - 12 * s, tx + 12 * s, ty + 12 * s), fill=(70, 50, 20))
    if mood:
        fx, fy = xf([(0, 10)], cx, cy, s, ang)[0]
        face(d, fx, fy - 10 * s, 0.9 * s, t, mood)


def straw_w(y):
    """Half-width of the strawberry body at y in [-1, 1] (top -> tip)."""
    v = (y + 1) / 2
    w = math.sin(math.pi * (0.4 + 0.6 * v)) ** 0.8 / 0.95
    if v < 0.14:
        w *= 0.35 + 0.65 * math.sqrt(max(0.0, 1 - ((0.14 - v) / 0.14) ** 2))
    return w


def strawberry(d, cx, cy, s, t=0.0, mood=None, seed_glow=0.0, seed_scale=1.0):
    hw, hh = 165 * s, 200 * s
    left, right = [], []
    for k in range(41):
        y = -1 + 2 * k / 40
        w = straw_w(y)
        left.append((cx - w * hw, cy + y * hh))
        right.append((cx + w * hw, cy + y * hh))
    d.polygon(left + right[::-1], fill=STRAW, outline=STRAW_D, width=max(2, int(6 * s)))
    d.ellipse((cx - hw * 0.6, cy - hh * 0.75, cx - hw * 0.25, cy - hh * 0.25), fill=(255, 120, 130, 120))
    seeds = []
    for row in range(9):
        y = -0.72 + row * 0.19
        w = straw_w(y) * 0.86
        nn = max(1, int(w * 6))
        for j in range(nn):
            xx = (-1 + (2 * j + 1 + (row % 2) * 0.5) / (nn + 0.5)) * w
            if abs(xx) < w:
                seeds.append((cx + xx * hw, cy + y * hh))
    for i, (x, y) in enumerate(seeds):
        r = 7 * s * seed_scale
        if seed_glow > 0:
            g = seed_glow * (0.6 + 0.4 * math.sin(t * 6 + i))
            d.ellipse((x - r * 2, y - r * 2, x + r * 2, y + r * 2), fill=(255, 240, 120, int(80 * g)))
        d.ellipse((x - r * 0.7, y - r, x + r * 0.7, y + r), fill=(255, 225, 90), outline=(170, 120, 20), width=max(1, int(2 * s)))
    # leaves
    for k in range(6):
        a = -math.pi / 2 + (k - 2.5) * 0.5
        tip = (cx + 150 * s * math.cos(a) * 1.1, cy - hh * 0.95 + 70 * s * (math.sin(a) + 1) * 0.6 - 30 * s)
        b1 = (cx + 30 * s * math.cos(a + 1.2), cy - hh * 0.95)
        b2 = (cx + 30 * s * math.cos(a - 1.2), cy - hh * 0.95)
        d.polygon([b1, tip, b2], fill=LEAF, outline=LEAF_D)
    d.rounded_rectangle((cx - 8 * s, cy - hh * 0.95 - 70 * s, cx + 8 * s, cy - hh * 0.95), radius=6 * s, fill=LEAF_D)
    if mood:
        face(d, cx, cy - 30 * s, 0.9 * s, t, mood)
    return seeds


def raspberry(d, cx, cy, s, t=0.0, mood=None):
    rows = [(5, 0.95), (6, 0.95), (6, 0.9), (5, 0.78), (4, 0.6), (3, 0.42)]
    for ri, (n, wf) in enumerate(rows):
        y = cy + (130 - ri * 52) * s
        for j in range(n):
            x = cx + (-1 + (2 * j + 1) / n) * 150 * s * wf
            r = 36 * s
            d.ellipse((x - r, y - r, x + r, y + r), fill=(215, 30, 80), outline=(140, 10, 50), width=max(2, int(4 * s)))
            d.ellipse((x - r * 0.5, y - r * 0.6, x - r * 0.1, y - r * 0.2), fill=(255, 150, 180))
    for k in range(5):
        a = -math.pi / 2 + (k - 2) * 0.6
        d.polygon([(cx - 15 * s, cy - 170 * s), (cx + 110 * s * math.cos(a), cy - 190 * s + 60 * s * (math.sin(a) + 1)),
                   (cx + 15 * s, cy - 170 * s)], fill=LEAF, outline=LEAF_D)
    if mood:
        face(d, cx, cy + 10 * s, 0.9 * s, t, mood)


def tomato(d, cx, cy, s, t=0.0):
    d.ellipse((cx - 150 * s, cy - 125 * s, cx + 150 * s, cy + 125 * s), fill=(235, 55, 45), outline=(150, 20, 15), width=max(2, int(6 * s)))
    d.ellipse((cx - 100 * s, cy - 90 * s, cx - 40 * s, cy - 40 * s), fill=(255, 140, 120, 160))
    for k in range(6):
        a = k / 6 * 2 * math.pi
        d.polygon([(cx, cy - 115 * s), (cx + 80 * s * math.cos(a), cy - 115 * s + 35 * s * math.sin(a)),
                   (cx + 20 * s * math.cos(a + 0.6), cy - 115 * s + 10 * s * math.sin(a + 0.6))], fill=LEAF, outline=LEAF_D)
    d.rounded_rectangle((cx - 6 * s, cy - 165 * s, cx + 6 * s, cy - 115 * s), radius=5 * s, fill=LEAF_D)


def cucumber(d, cx, cy, s, t=0.0):
    pts = poly_ellipse(cx, cy, 190 * s, 70 * s, -0.25, 40)
    d.polygon(pts, fill=(60, 150, 60), outline=(25, 90, 30))
    for k in range(4):
        d.line(xf([(-150, -35 + k * 22), (150, -35 + k * 22)], cx, cy, s, -0.25), fill=(110, 190, 90), width=max(2, int(5 * s)))
    for k in range(14):
        x, y = xf([(-160 + (k * 53) % 320, -45 + (k * 37) % 90)], cx, cy, s, -0.25)[0]
        d.ellipse((x - 5 * s, y - 5 * s, x + 5 * s, y + 5 * s), fill=(220, 240, 200))


def watermelon(d, cx, cy, s, t=0.0):
    r = 190 * s
    d.pieslice((cx - r, cy - r, cx + r, cy + r), 0, 180, fill=(40, 140, 50))
    r2 = r * 0.9
    d.pieslice((cx - r2, cy - r2, cx + r2, cy + r2), 0, 180, fill=(240, 250, 220))
    r3 = r * 0.82
    d.pieslice((cx - r3, cy - r3, cx + r3, cy + r3), 0, 180, fill=(240, 60, 80))
    for k in range(9):
        a = math.radians(20 + k * 17)
        rr = r3 * (0.45 + 0.25 * (k % 2))
        x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
        d.polygon(poly_ellipse(x, y, 7 * s, 12 * s, a, 10), fill=(30, 20, 20))
    d.line([(cx - r, cy), (cx + r, cy)], fill=(200, 40, 60), width=max(2, int(4 * s)))


def avocado(d, cx, cy, s, t=0.0):
    def shape(k):
        return [(cx + k * 130 * s * math.cos(a) * (0.75 + 0.25 * math.sin(a)),
                 cy + k * 170 * s * math.sin(a) + 30 * s) for a in [i / 40 * 2 * math.pi for i in range(40)]]
    d.polygon(shape(1.0), fill=(50, 90, 30), outline=(30, 50, 15))
    d.polygon(shape(0.9), fill=(220, 235, 130))
    d.polygon(shape(0.78), fill=(240, 245, 170))
    d.ellipse((cx - 62 * s, cy + 20 * s, cx + 62 * s, cy + 140 * s), fill=(130, 75, 35), outline=(80, 40, 15), width=max(2, int(4 * s)))
    d.ellipse((cx - 35 * s, cy + 40 * s, cx - 10 * s, cy + 70 * s), fill=(190, 130, 80))


def stamp(img, s, cx, cy, col, ang, t, t0, size=70):
    if t < t0:
        return
    u = prog(t, t0, t0 + 0.25)
    sc = lerp(2.2, 1.0, ease_out(u))
    f = R.font(size)
    tmp = ImageDraw.Draw(img)
    bb = tmp.textbbox((0, 0), s, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    pad = 26
    im = Image.new("RGBA", (int(tw + pad * 2 + 20), int(th + pad * 2 + 20)), (0, 0, 0, 0))
    dd = ImageDraw.Draw(im)
    dd.rounded_rectangle((10, 10, im.width - 10, im.height - 10), radius=22, fill=(255, 255, 255, 235), outline=col, width=10)
    dd.text((im.width / 2, im.height / 2), s, font=f, anchor="mm", fill=col)
    im = im.rotate(ang, resample=Image.BICUBIC, expand=True)
    im = im.resize((max(1, int(im.width * sc)), max(1, int(im.height * sc))), Image.BILINEAR)
    if u < 1:
        a = im.getchannel("A").point(lambda v: int(v * clamp(u * 2.5)))
        im.putalpha(a)
    img.paste(im, (int(cx - im.width / 2), int(cy - im.height / 2)), im)


def label_arrow(d, s, x, y, tx, ty, t, t0, size=48, col=(255, 255, 255)):
    if t < t0:
        return
    u = ease_out(prog(t, t0, t0 + 0.4))
    ex, ey = lerp(x, tx, u), lerp(y, ty, u)
    d.line([(x, y), (ex, ey)], fill=col, width=6)
    if u > 0.95:
        ang = math.atan2(ty - y, tx - x)
        d.polygon([(tx, ty), (tx - 28 * math.cos(ang - 0.45), ty - 28 * math.sin(ang - 0.45)),
                   (tx - 28 * math.cos(ang + 0.45), ty - 28 * math.sin(ang + 0.45))], fill=col)
    pop_text(d, s, x, y - 40, size, t, t0, fill=col)


def magnifier(img, cx, cy, r, src_center, zoom, draw_fn):
    """Draws a round loupe at (cx, cy) showing draw_fn content magnified around src_center."""
    big = Image.new("RGBA", (int(2 * r), int(2 * r)), (255, 240, 220, 255))
    sz = int(2 * r / zoom)
    tmp = Image.new("RGBA", (sz, sz), (250, 240, 215, 255))
    td = ImageDraw.Draw(tmp, "RGBA")
    draw_fn(td, sz / 2 - src_center[0], sz / 2 - src_center[1])
    big = tmp.resize(big.size, Image.BICUBIC)
    mask = Image.new("L", big.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, 2 * r - 1, 2 * r - 1), fill=255)
    img.paste(big, (int(cx - r), int(cy - r)), mask)
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(250, 250, 255), width=14)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(60, 60, 80), width=4)
    hx, hy = cx + r * 0.72, cy + r * 0.72
    d.line([(hx, hy), (hx + r * 0.55, hy + r * 0.55)], fill=(90, 60, 40), width=34)


# ------------------------------------------------------------------ scenes
def scene_hook(img, d, t):
    bob = math.sin(t * 4)
    bu = back_out(prog(t, 0.1, 0.6))
    su = back_out(prog(t, 0.3, 0.8))
    if bu > 0:
        banana(d, 300, 1050 + 20 * bob, 1.15 * bu, -0.35 + 0.08 * bob, t, mood="happy")
    if su > 0:
        strawberry(d, 790, 1060 - 20 * bob, 1.15 * su, t, mood="shock" if t > 3.1 else "happy")
    text(d, "КТО ИЗ НИХ", W / 2, 270, 96 * back_out(prog(t, 0.0, 0.4)), fill=(255, 255, 255))
    text(d, "ЯГОДА?", W / 2, 400, 150 * back_out(prog(t, 0.15, 0.55)), fill=YEL, stroke=(70, 30, 0))
    stamp(img, "ЯГОДА ✓", 300, 1350, GREEN_OK, 10, t, 1.3)
    stamp(img, "НЕ ЯГОДА ✗", 790, 1360, RED_NO, -8, t, 3.1)


def flower_berry(img, d, t):
    t0 = 5.0
    cx, cy = W / 2, 1000
    grow = back_out(prog(t, t0 + 0.1, t0 + 0.8))
    fall = prog(t, t0 + 4.0, t0 + 6.0)
    swell = ease_io(prog(t, t0 + 4.5, t0 + 6.3))
    cut = t >= t0 + 6.8
    # stem
    d.line([(cx, 1560), (cx, cy + 40)], fill=LEAF_D, width=22)
    d.polygon([(cx, 1400), (cx + 150, 1330), (cx + 60, 1430)], fill=LEAF, outline=LEAF_D)
    d.polygon([(cx, 1300), (cx - 150, 1240), (cx - 60, 1340)], fill=LEAF, outline=LEAF_D)
    # petals
    if fall < 1:
        for k in range(5):
            a = -math.pi / 2 + k * 2 * math.pi / 5
            dist = 95 * grow
            px, py = cx + dist * math.cos(a), cy - 70 + dist * math.sin(a)
            py += 900 * fall ** 2 * (0.8 + 0.1 * k)
            px += 120 * fall * math.cos(a)
            col = (255, 140, 190, int(255 * (1 - fall)))
            d.polygon(poly_ellipse(px, py, 90 * grow, 52 * grow, a + fall * 3 * (1 if k % 2 else -1)), fill=col, outline=(220, 80, 140, int(255 * (1 - fall))))
        if fall < 0.4:
            r = 38 * grow
            d.ellipse((cx - r, cy - 70 - r, cx + r, cy - 70 + r), fill=(255, 220, 60, int(255 * (1 - fall * 2.5))))
    # ovary / fruit
    orad = lerp(46, 200, swell) * grow
    ocol = lerp_col((120, 200, 90), (120, 60, 180), swell)
    oy = cy + 95 - lerp(0, 215, swell)
    if not cut:
        d.ellipse((cx - orad, oy - orad * 1.05, cx + orad, oy + orad * 1.05), fill=ocol, outline=(40, 70, 30) if swell < 0.5 else (60, 20, 100), width=6)
        d.ellipse((cx - orad * 0.55, oy - orad * 0.7, cx - orad * 0.15, oy - orad * 0.3), fill=(255, 255, 255, 110))
    else:
        u = ease_out(prog(t, t0 + 6.8, t0 + 7.3))
        gap = 40 * u
        for sx in (-1, 1):
            x0 = cx + sx * gap
            box = (x0 - orad, oy - orad * 1.05, x0 + orad, oy + orad * 1.05)
            a0, a1 = (90, 270) if sx < 0 else (270, 450)
            d.pieslice(box, a0, a1, fill=(120, 60, 180), outline=(60, 20, 100), width=6)
            inner = (x0 - orad * 0.88, oy - orad * 0.93, x0 + orad * 0.88, oy + orad * 0.93)
            d.pieslice(inner, a0, a1, fill=(215, 175, 240))
            for k in range(5):
                a = math.radians(a0 + 20 + k * 35)
                sxp, syp = x0 + orad * 0.45 * math.cos(a), oy + orad * 0.5 * math.sin(a)
                d.polygon(poly_ellipse(sxp, syp, 12, 20, a, 12), fill=(90, 55, 30), outline=(50, 25, 10))
        label_arrow(d, "мясистый плод", 230, 620, cx - 150, oy - 130, t, t0 + 7.3, size=46, col=(255, 200, 255))
        label_arrow(d, "семена внутри", 820, 1380, cx + 90, oy + 60, t, t0 + 8.0, size=46, col=YEL)
    if t < t0 + 4.0:
        label_arrow(d, "завязь", 220, 1330, cx - 50, cy + 110, t, t0 + 1.4, size=56, col=(190, 255, 150))
    pop_text(d, "1 ЦВЕТОК = 1 ЗАВЯЗЬ", W / 2, 290, 80, t, t0 + 0.3, fill=YEL, stroke=(70, 30, 0))
    if t > t0 + 4.3:
        pop_text(d, "↓  ЯГОДА", W / 2, 410, 64, t, t0 + 4.3, fill=(230, 190, 255))


def draw_banana_slice(d, cx, cy, r, wild=False, t=0.0, glow=0.0):
    d.ellipse((cx - r, cy - r * 0.92, cx + r, cy + r * 0.92), fill=(250, 220, 80), outline=BANANA_D, width=max(2, int(r * 0.04)))
    d.ellipse((cx - r * 0.9, cy - r * 0.83, cx + r * 0.9, cy + r * 0.83), fill=(255, 246, 215))
    if not wild:
        d.ellipse((cx - r * 0.42, cy - r * 0.4, cx + r * 0.42, cy + r * 0.4), fill=(245, 230, 190))
        for k in range(3):
            a = -math.pi / 2 + k * 2 * math.pi / 3
            d.line([(cx, cy), (cx + r * 0.4 * math.cos(a), cy + r * 0.4 * math.sin(a))], fill=(225, 205, 160), width=max(2, int(r * 0.03)))
        for k in range(12):
            a = k / 12 * 2 * math.pi + 0.2
            rr = r * (0.22 if k % 2 else 0.3)
            x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
            sr = r * 0.03
            if glow > 0:
                g = glow * (0.6 + 0.4 * math.sin(t * 7 + k))
                d.ellipse((x - sr * 4, y - sr * 4, x + sr * 4, y + sr * 4), fill=(255, 120, 60, int(120 * g)))
            d.ellipse((x - sr, y - sr, x + sr, y + sr), fill=(40, 25, 20))
    else:
        for k in range(9):
            a = k / 9 * 2 * math.pi
            rr = r * (0.0 if k == 0 else 0.48)
            x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
            sr = r * 0.17
            d.ellipse((x - sr, y - sr, x + sr, y + sr), fill=(35, 25, 25), outline=(10, 5, 5), width=3)
            d.ellipse((x - sr * 0.6, y - sr * 0.6, x - sr * 0.15, y - sr * 0.15), fill=(120, 110, 110))


def scene_banana(img, d, t):
    t0 = 15.0
    slice_t = t0 + 1.4
    pop_text(d, "БАНАН — ЯГОДА", W / 2, 290, 96, t, t0 + 0.2, fill=YEL, stroke=(70, 30, 0))
    if t < slice_t:
        u = ease_out(prog(t, t0, t0 + 0.6))
        banana(d, lerp(-300, W / 2, u), 1000, 1.6, -0.1, t, mood="happy")
    else:
        sl = prog(t, slice_t, slice_t + 0.25)
        if sl < 1:
            d.line([(150, 1300), (930, 700)], fill=(255, 255, 255, int(255 * (1 - sl))), width=int(30 * (1 - sl)) + 2)
        move = ease_io(prog(t, t0 + 5.4, t0 + 6.1))
        cx, cy, r = lerp(W / 2, 290, move), lerp(1000, 950, move), lerp(330, 210, move) * back_out(prog(t, slice_t, slice_t + 0.4))
        glow = prog(t, t0 + 2.2, t0 + 2.6)
        draw_banana_slice(d, cx, cy, r, False, t, glow)
        if t0 + 2.6 < t < t0 + 5.4:
            mu = back_out(prog(t, t0 + 2.6, t0 + 3.0))
            def fn(dd, ox, oy):
                draw_banana_slice(dd, cx + ox, cy + oy, r, False, t, 0)
            magnifier(img, 760, 640, 170 * mu + 1, (cx + r * 0.3, cy), 3.2, fn)
            d2 = ImageDraw.Draw(img, "RGBA")
            pop_text(d2, "это семена!", 760, 860, 54, t, t0 + 3.2, fill=YEL)
        if move > 0:
            text(d, "обычный", cx, cy + 280, 48, alpha=255 * move)
            wu = back_out(prog(t, t0 + 6.0, t0 + 6.5))
            if wu > 0:
                draw_banana_slice(d, 790, 950, 210 * wu, True, t)
                text(d, "дикий", 790, 1230, 48, fill=(255, 190, 120), alpha=255 * prog(t, t0 + 6.2, t0 + 6.6))
            if t > t0 + 7.6:
                pu = back_out(prog(t, t0 + 7.6, t0 + 8.0))
                for k in range(4):
                    x = 690 + k * 70
                    d.ellipse((x - 26 * pu, 1330 - 26 * pu, x + 26 * pu, 1330 + 26 * pu), fill=(120, 200, 80), outline=(50, 120, 30), width=4)
                text(d, "как горошины!", 790, 1420, 48, fill=(190, 255, 150), alpha=255 * prog(t, t0 + 7.8, t0 + 8.1))
                text(d, "=", 600, 1330, 70, alpha=255 * pu)


def scene_strawberry(img, d, t):
    t0 = 25.0
    pop_text(d, "СЕМЕНА СНАРУЖИ!", W / 2, 290, 86, t, t0 + 0.2, fill=(255, 140, 160), stroke=(70, 0, 20))
    shrink = ease_io(prog(t, t0 + 7.0, t0 + 7.8))
    cx = lerp(W / 2, 300, shrink)
    cy = lerp(1000, 1000, shrink)
    s = lerp(1.9, 1.15, shrink) * back_out(prog(t, t0, t0 + 0.5))
    glow = prog(t, t0 + 1.8, t0 + 2.4) * (1 - shrink)
    seeds = strawberry(d, cx, cy + 40, s, t, mood="shock" if t < t0 + 7 else "happy", seed_glow=glow)
    if t0 + 3.0 < t < t0 + 7.0:
        mu = back_out(prog(t, t0 + 3.0, t0 + 3.4))
        sx, sy = seeds[len(seeds) // 2 + 3]

        def fn(dd, ox, oy):
            strawberry(dd, cx + ox, cy + 40 + oy, s, t, seed_glow=0)
        magnifier(img, 770, 620, 160 * mu + 1, (sx, sy), 4.0, fn)
        d2 = ImageDraw.Draw(img, "RGBA")
        d2.line([(sx, sy), (680, 720)], fill=(255, 255, 255, 160), width=4)
        pop_text(d2, "это плод!", 770, 830, 56, t, t0 + 3.6, fill=YEL)
        pop_text(d2, "≈ 200 штук", 300, 470, 50, t, t0 + 4.4, fill=(255, 255, 255))
    if shrink > 0:
        # inset: flower base (receptacle) swelling into strawberry flesh
        ix, iy = 790, 1000
        g = ease_io(prog(t, t0 + 8.5, t0 + 11.0))
        r = lerp(55, 170, g)
        col = lerp_col((180, 220, 120), STRAW, g)
        a = shrink
        d.rounded_rectangle((590, 650, 990, 1340), radius=36, fill=(255, 255, 255, int(30 * a)), outline=(255, 255, 255, int(120 * a)), width=4)
        d.line([(ix, 1320), (ix, iy + r * 0.6)], fill=LEAF_D, width=16)
        for k in range(5):
            ang = math.pi / 2 + (k - 2) * 0.45
            d.polygon([(ix, iy + r * 0.6), (ix + 110 * math.cos(ang - 0.3), iy + r * 0.6 + 40), (ix + 110 * math.cos(ang + 0.3), iy + r * 0.6 + 50)],
                      fill=LEAF, outline=LEAF_D)
        d.ellipse((ix - r * 0.9, iy - r, ix + r * 0.9, iy + r * 0.7), fill=col, outline=STRAW_D if g > 0.5 else LEAF_D, width=5)
        for k in range(14):
            ang = k / 14 * 2 * math.pi
            px, py = ix + r * 0.75 * math.cos(ang) * 0.95, iy - r * 0.15 + r * 0.72 * math.sin(ang)
            d.ellipse((px - 7, py - 9, px + 7, py + 9), fill=(255, 225, 90), outline=(170, 120, 20), width=2)
        text(d, "основание", ix, 720, 46, fill=(255, 255, 255), alpha=255 * a)
        text(d, "цветка", ix, 775, 46, fill=(255, 255, 255), alpha=255 * a)
        if g > 0.2:
            pop_text(d, "разрослось!", ix, 1270, 48, t, t0 + 9.6, fill=YEL)
        label_arrow(d, "сочная часть", 300, 1480, 300, 1210, t, t0 + 11.0, size=46, col=(255, 160, 170))


BERRIES = [(tomato, "помидор", 290, 760, 2.2), (cucumber, "огурец", 790, 760, 3.1), (watermelon, "арбуз", 290, 1180, 3.8),
           (avocado, "авокадо", 790, 1180, 5.1)]


def scene_berries(img, d, t):
    t0 = 38.0
    pop_text(d, "ЯГОДЫ ПО НАУКЕ:", W / 2, 290, 92, t, t0 + 0.2, fill=YEL, stroke=(70, 30, 0))
    final = t > t0 + 6.0
    for k, (fn, name, x, y, dt) in enumerate(BERRIES):
        ts = t0 + dt
        if t < ts:
            continue
        u = back_out(prog(t, ts, ts + 0.45))
        bob = 12 * math.sin(t * 6 + k) if final else 0
        sc = 0.95 * u * (1 + 0.06 * math.sin(t * 8 + k) * final)
        yy = y + bob - (40 if fn is watermelon else 0)
        fn(d, x, yy, sc, t)
        text(d, name, x, y + 190, 52, alpha=255 * clamp(u))
        stamp(img, "ЯГОДА ✓", x + 110, y - 120, GREEN_OK, 12 - 8 * (k % 2) * 3, t, ts + 0.4, size=40)
        d = ImageDraw.Draw(img, "RGBA")
    if final:
        pop_text(d, "даже авокадо!", W / 2, 1460, 76, t, t0 + 6.0, fill=(190, 255, 150), stroke=(20, 60, 10))


def scene_raspberry(img, d, t):
    t0 = 50.0
    u = back_out(prog(t, t0, t0 + 0.4))
    raspberry(d, W / 2, 1000, 1.7 * u + 0.01, t, mood="sad" if t > t0 + 1.2 else "happy")
    pop_text(d, "И ОНА ТОЖЕ", W / 2, 300, 100, t, t0 + 0.2, fill=(255, 140, 180), stroke=(70, 0, 30))
    stamp(img, "НЕ ЯГОДА ✗", W / 2, 1380, RED_NO, -9, t, t0 + 1.1, size=84)


def scene_outro(img, d, t):
    R.scene_outro(img, d, t)
    pop_text(d, "завтра — новый факт!", W / 2, 1490, 58, t, 54.5, fill=YEL)


SCENES = [(0, scene_hook), (5, flower_berry), (15, scene_banana), (25, scene_strawberry), (38, scene_berries),
          (50, scene_raspberry), (53, scene_outro)]
IMPACTS = ((1.3, 16), (3.1, 22), (16.4, 14), (51.1, 22))


def camera(img, t, ot):
    z, dx, dy = 1.0, 0.0, 0.0
    for c in (0,) + CUTS:
        u = prog(t, c, c + 0.35)
        if 0 < u < 1:
            z = max(z, lerp(1.12, 1.0, ease_out(u)))
    for ts, amt in IMPACTS:
        if ts <= ot < ts + 0.4:
            k = (1 - (ot - ts) / 0.4) * amt
            dx += k * math.sin(ot * 90)
            dy += k * math.cos(ot * 70)
    if z == 1.0 and dx == 0 and dy == 0:
        return img
    cw, ch = W / z, H / z
    x0, y0 = (W - cw) / 2 + dx, (H - ch) / 2 + dy
    return img.transform((W, H), Image.EXTENT, (x0, y0, x0 + cw, y0 + ch), Image.BILINEAR)


def render_frame(i):
    global BG3
    if BG3 is None:
        BG3 = make_bg()
    t = i / FPS
    ot = scene_time(t)
    img = BG3.copy()
    d = ImageDraw.Draw(img, "RGBA")
    draw_bg_fx(d, t)
    fn = [f for s, f in SCENES if ot >= s][-1]
    fn(img, d, ot)
    img = camera(img, t, ot)
    d = ImageDraw.Draw(img, "RGBA")
    R.draw_subs(d, t)
    d.rectangle((0, 0, W * t / DUR, 12), fill=YEL)
    text(d, "Факты за минуту", W - 200, 80, 34, fill=(255, 255, 255), alpha=150, sw=2)
    for c in CUTS:
        if c <= t < c + 0.12:
            d.rectangle((0, 0, W, H), fill=(255, 255, 255, int(150 * (1 - (t - c) / 0.12))))
    fade = max(1 - t / 0.2, 1 - (DUR - t) / 0.4, 0)
    if fade > 0:
        d.rectangle((0, 0, W, H), fill=(0, 0, 0, int(255 * clamp(fade))))
    return img.tobytes()


def events():
    ev = [(0.1, "pop"), (0.3, "pop"), (1.3, "boom"), (3.1, "boom"), (5.3, "pop"), (6.4, "ding"), (9.0, "whoosh"),
          (11.8, "whoosh"), (12.3, "pop"), (13.0, "pop"), (15.2, "whoosh"), (16.4, "whoosh"), (16.4, "pop"),
          (17.2, "ding"), (17.6, "pop"), (21.0, "pop"), (22.6, "pop"), (25.2, "pop"), (26.8, "ding"), (28.0, "pop"),
          (29.4, "pop"), (32.0, "whoosh"), (34.6, "pop"), (36.0, "pop"), (38.2, "pop"), (51.1, "boom"), (50.1, "pop"),
          (56.5, "pop"), (56.7, "ding")]
    for _, _, _, _, dt in BERRIES:
        ev += [(38 + dt, "pop"), (38 + dt + 0.4, "boom")]
    ev += [(44.0 + k * 0.15, "tick") for k in range(4)]
    ev = [(to_new(tm), k) for tm, k in ev]
    ev = [(tm, k) for tm, k in ev if tm is not None] + [(c - 0.15, "whoosh") for c in CUTS]
    return sorted(ev)


def main():
    if sys.argv[1] == "--events":
        json.dump(events(), open(sys.argv[2], "w"))
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
        for fr in pool.imap(render_frame, range(n), chunksize=8):
            ff.stdin.write(fr)
    ff.stdin.close()
    ff.wait()


if __name__ == "__main__":
    main()
