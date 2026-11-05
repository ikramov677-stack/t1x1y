"""Renders the 60-second vertical short «У осьминога три сердца» frame by frame.

Frames are drawn procedurally with Pillow and piped as raw RGB into ffmpeg.
Usage: python3 render.py out_video_noaudio.mp4
"""
import math
import random
import subprocess
import sys
from multiprocessing import Pool

from PIL import Image, ImageDraw, ImageFont

W, H, FPS, DUR = 1080, 1920, 30, 60.0
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_fonts = {}


def font(size):
    size = max(8, int(size))
    if size not in _fonts:
        _fonts[size] = ImageFont.truetype(FONT_BOLD, size)
    return _fonts[size]


# ---------------------------------------------------------------- helpers
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def prog(t, t0, t1):
    return clamp((t - t0) / (t1 - t0))


def ease_out(x):
    return 1 - (1 - x) ** 3


def ease_io(x):
    return 3 * x * x - 2 * x * x * x


def back_out(x):
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def lerp(a, b, u):
    return a + (b - a) * u


def lerp_col(c1, c2, u):
    return tuple(int(lerp(a, b, u)) for a, b in zip(c1, c2))


def text(d, s, cx, cy, size, fill=(255, 255, 255), stroke=(15, 20, 45), sw=None, alpha=255):
    if size < 8 or alpha <= 0:
        return
    f = font(size)
    sw = int(size * 0.09) if sw is None else sw
    fill = tuple(fill[:3]) + (int(alpha),)
    stroke = tuple(stroke[:3]) + (int(alpha),)
    d.text((cx, cy), s, font=f, fill=fill, anchor="mm", stroke_width=sw, stroke_fill=stroke)


def pop_text(d, s, cx, cy, size, t, t0, dur=0.45, **kw):
    if t < t0:
        return
    u = prog(t, t0, t0 + dur)
    sc = back_out(u)
    text(d, s, cx, cy, size * sc, alpha=255 * clamp(u * 3), **kw)


def heart_poly(cx, cy, size, rot=0.0):
    pts = []
    for i in range(48):
        a = 2 * math.pi * i / 48
        x = 16 * math.sin(a) ** 3
        y = 13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a)
        x, y = x * size / 16, -y * size / 16
        xr = x * math.cos(rot) - y * math.sin(rot)
        yr = x * math.sin(rot) + y * math.cos(rot)
        pts.append((cx + xr, cy + yr))
    return pts


def draw_heart(d, cx, cy, size, fill=(235, 50, 70), outline=(120, 10, 30), glow=0.0):
    if glow > 0:
        for k in range(4, 0, -1):
            d.polygon(heart_poly(cx, cy, size * (1 + 0.18 * k * glow)), fill=fill[:3] + (int(40 * glow),))
    d.polygon(heart_poly(cx, cy, size), fill=fill, outline=outline, width=max(2, int(size * 0.1)))
    # highlight
    d.ellipse((cx - size * 0.55, cy - size * 0.55, cx - size * 0.25, cy - size * 0.3), fill=(255, 255, 255, 140))


def beat(t, bpm=80.0, phase=0.0):
    """Heart pulse 0..1 envelope (lub-dub)."""
    p = ((t + phase) * bpm / 60.0) % 1.0
    return math.exp(-((p - 0.05) / 0.05) ** 2) + 0.6 * math.exp(-((p - 0.22) / 0.05) ** 2)


def along(pts, u):
    """Point at fraction u along a polyline."""
    if u <= 0:
        return pts[0]
    seg = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    total = sum(seg)
    target = u * total
    for i, L in enumerate(seg):
        if target <= L or i == len(seg) - 1:
            k = 0 if L == 0 else clamp(target / L)
            return (lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k))
        target -= L
    return pts[-1]


def bezier(p0, p1, p2, p3, n=24):
    out = []
    for i in range(n + 1):
        u = i / n
        a, b, c, e = (1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3
        out.append((a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1]))
    return out


def arrow(d, p0, p1, col, w=10, head=34):
    d.line([p0, p1], fill=col, width=w)
    ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
    a1, a2 = ang + 2.6, ang - 2.6
    d.polygon([p1, (p1[0] + head * math.cos(a1), p1[1] + head * math.sin(a1)),
               (p1[0] + head * math.cos(a2), p1[1] + head * math.sin(a2))], fill=col)


# ---------------------------------------------------------------- background
def make_bg():
    bg = Image.new("RGB", (W, H))
    px = bg.load()
    top, bot = (24, 120, 170), (6, 22, 60)
    for y in range(H):
        u = y / H
        c = lerp_col(top, bot, u ** 0.8)
        for x in range(W):
            px[x, y] = c
    return bg


BG = None
rng = random.Random(7)
BUBBLES = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(6, 22), rng.uniform(40, 120), rng.uniform(0, 6.28))
           for _ in range(28)]
SNOW = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(10, 26), rng.uniform(60, 140), rng.uniform(0, 6.28))
        for _ in range(40)]


def draw_ambient(d, t, rays=True):
    if rays:
        for i in range(5):
            x = 120 + i * 220 + 60 * math.sin(t * 0.4 + i)
            wdt = 70 + 30 * math.sin(t * 0.7 + i * 2)
            d.polygon([(x - wdt * 0.4, 0), (x + wdt * 0.4, 0), (x + wdt * 2.2 + 200, H * 0.75), (x - wdt + 200, H * 0.75)],
                      fill=(200, 240, 255, 16))
    for (x0, y0, r, sp, ph) in BUBBLES:
        y = (y0 - t * sp) % (H + 100) - 50
        x = x0 + 18 * math.sin(t * 1.3 + ph)
        d.ellipse((x - r, y - r, x + r, y + r), outline=(210, 245, 255, 120), width=3)
        d.ellipse((x - r * 0.5, y - r * 0.6, x - r * 0.1, y - r * 0.2), fill=(255, 255, 255, 110))


def draw_seabed(d, t, y0=1480):
    pts = [(0, H)]
    for x in range(0, W + 41, 40):
        pts.append((x, y0 + 30 * math.sin(x * 0.006 + 1) + 14 * math.sin(x * 0.02)))
    pts.append((W, H))
    d.polygon(pts, fill=(196, 160, 104))
    for i in range(30):
        x = (i * 137) % W
        y = y0 + 80 + (i * 71) % 300
        d.ellipse((x, y, x + 14, y + 8), fill=(170, 135, 85))
    # rocks
    d.ellipse((60, y0 - 40, 260, y0 + 70), fill=(95, 105, 120))
    d.ellipse((820, y0 - 20, 1010, y0 + 80), fill=(85, 95, 110))
    # seaweed
    for bx, hgt, col in ((140, 330, (40, 150, 90)), (190, 240, (55, 170, 100)), (930, 360, (40, 150, 90)), (880, 260, (60, 180, 110))):
        pts = []
        for k in range(14):
            v = k / 13
            pts.append((bx + 26 * math.sin(t * 1.5 + v * 4 + bx) * v, y0 + 10 - hgt * v))
        d.line(pts, fill=col, width=18, joint="curve")


# ---------------------------------------------------------------- octopus
OCT = (238, 96, 66)
OCT_DARK = (190, 62, 46)
OCT_LIGHT = (255, 160, 120)


def draw_octopus(d, cx, cy, s, t, spread=1.0, amp=1.0, length=1.0, curl=1.0, squash=1.0, skip=(), look=(0, 0),
                 blink=True, smile=True, wave_speed=2.2, droop=0.0):
    """Draws a cartoon octopus. (cx, cy) is the centre of the eyes line. Returns tentacle point lists."""
    tentacles = []
    order = [0, 7, 1, 6, 2, 5, 3, 4]
    base_y = cy + 40 * s
    for idx in order:
        if idx in skip:
            tentacles.append(None)
            continue
        side = (idx - 3.5) / 3.5
        bx = cx + side * 80 * s
        a = math.pi / 2 + side * 1.15 * spread + droop * side
        x, y = bx, base_y
        pts = [(x, y)]
        n = 20
        seg = 13.5 * s * length
        for k in range(n):
            v = k / n
            a += amp * 0.11 * math.sin(t * wave_speed + idx * 0.9 - k * 0.35) * (0.3 + v) + curl * 0.035 * (1 if side > 0 else -1) * v * 2
            x += seg * math.cos(a)
            y += seg * math.sin(a)
            pts.append((x, y))
        tentacles.append((idx, pts))
        far = idx in (0, 7, 1, 6)
        col = OCT_DARK if far else OCT
        for k in range(n):
            w = lerp(36 * s, 5 * s, k / n)
            d.line([pts[k], pts[k + 1]], fill=col, width=int(w) + 1)
            d.ellipse((pts[k + 1][0] - w / 2, pts[k + 1][1] - w / 2, pts[k + 1][0] + w / 2, pts[k + 1][1] + w / 2), fill=col)
        if not far:
            for k in range(2, n - 3, 2):
                w = lerp(36 * s, 5 * s, k / n) * 0.28
                px, py = pts[k]
                d.ellipse((px - w, py - w, px + w, py + w), fill=OCT_LIGHT)
    # skirt
    d.ellipse((cx - 100 * s, cy - 10 * s, cx + 100 * s, cy + 70 * s), fill=OCT)
    # mantle (head)
    hw, hh = 125 * s / squash ** 0.5, 150 * s * squash
    d.ellipse((cx - hw, cy - hh * 1.55, cx + hw, cy + hh * 0.35), fill=OCT)
    for (ox, oy, r) in ((-55, -150, 18), (40, -175, 13), (70, -110, 10), (-20, -200, 9), (-80, -90, 8)):
        d.ellipse((cx + ox * s - r * s, cy + oy * s * squash - r * s, cx + ox * s + r * s, cy + oy * s * squash + r * s),
                  fill=OCT_LIGHT)
    d.ellipse((cx - hw * 0.62, cy - hh * 1.4, cx - hw * 0.2, cy - hh * 1.05), fill=(255, 190, 160, 120))
    # eyes
    closed = blink and (t % 3.7) < 0.12
    for sx in (-1, 1):
        ex, ey = cx + sx * 50 * s, cy - 10 * s
        if closed:
            d.line([(ex - 26 * s, ey), (ex + 26 * s, ey)], fill=(40, 20, 20), width=int(6 * s) + 1)
            continue
        d.ellipse((ex - 30 * s, ey - 32 * s, ex + 30 * s, ey + 32 * s), fill=(255, 250, 235), outline=OCT_DARK, width=int(4 * s) + 1)
        px, py = ex + look[0] * 10 * s, ey + look[1] * 10 * s
        d.rounded_rectangle((px - 18 * s, py - 9 * s, px + 18 * s, py + 9 * s), radius=9 * s, fill=(30, 20, 30))
        d.ellipse((px - 12 * s, py - 14 * s, px - 2 * s, py - 4 * s), fill=(255, 255, 255))
    if smile:
        d.arc((cx - 22 * s, cy + 5 * s, cx + 22 * s, cy + 38 * s), 20, 160, fill=(120, 30, 30), width=int(5 * s) + 1)
    return [p for p in tentacles if p]


def octo_layer(t, alpha, **kw):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer, "RGBA")
    tent = draw_octopus(ld, **kw, t=t)
    if alpha < 1:
        a = layer.getchannel("A").point(lambda v: int(v * alpha))
        layer.putalpha(a)
    return layer, tent


# ---------------------------------------------------------------- subtitles
VO = [
    (0.10, 4.78, "Знаете, сколько сердец у осьминога? Не одно… а целых три!"),
    (5.10, 5.55, "Два сердца качают кровь через жабры, чтобы насытить её кислородом."),
    (15.10, 4.28, "А третье, главное, разгоняет кровь по всему телу."),
    (22.10, 9.73, "Но вот что интересно: когда осьминог плывёт, главное сердце останавливается! Поэтому плавать он не любит и чаще ползает по дну."),
    (32.10, 11.29, "А ещё кровь у осьминога голубая. У нас кислород переносит железо, а у него — медь. Это помогает выживать в холодной воде, где кислорода мало."),
    (45.10, 5.92, "Три сердца, голубая кровь… и девять мозгов! Но об этом — в следующем видео."),
    (53.10, 5.69, "Подписывайтесь на «Факты за минуту», чтобы узнавать удивительное каждый день!"),
]


def build_chunks():
    chunks = []
    for start, dur, line in VO:
        words = line.split()
        groups, cur = [], []
        for w in words:
            if cur and (len(" ".join(cur + [w])) > 20):
                groups.append(cur)
                cur = []
            cur.append(w)
            if w[-1] in ".!?…:" and len(" ".join(cur)) > 6:
                groups.append(cur)
                cur = []
        if cur:
            groups.append(cur)
        weights = [len(" ".join(g)) + 4 for g in groups]
        total = sum(weights)
        tt = start
        for g, wgt in zip(groups, weights):
            dt = dur * wgt / total
            chunks.append((tt, tt + dt, " ".join(g)))
            tt += dt
    return chunks


CHUNKS = build_chunks()


def draw_subs(d, t):
    for (a, b, s) in CHUNKS:
        if a <= t < b + 0.05:
            u = prog(t, a, a + 0.12)
            sz = int(62 * (0.85 + 0.15 * ease_out(u)))
            f = font(sz)
            bbox = d.textbbox((W / 2, 1640), s, font=f, anchor="mm", stroke_width=6)
            d.rounded_rectangle((bbox[0] - 28, bbox[1] - 18, bbox[2] + 28, bbox[3] + 18), radius=26, fill=(0, 0, 0, 120))
            text(d, s, W / 2, 1640, sz, fill=(255, 255, 255), stroke=(0, 0, 0), sw=6)
            return


# ---------------------------------------------------------------- scenes
def scene_hook(img, d, t):
    # 0–5 s: octopus close-up, «3 СЕРДЦА?!»
    zoom = lerp(1.25, 1.9, ease_out(prog(t, 0, 5)))
    draw_octopus(d, W / 2, 1080 + 40 * math.sin(t * 1.5), zoom, t, look=(0.3 * math.sin(t), -0.5))
    pop_text(d, "3 СЕРДЦА?!", W / 2, 300, 150, t, 0.35, fill=(255, 214, 64), stroke=(90, 20, 10))
    if t > 2.6:
        # three pulsing hearts around the title
        for i, x in enumerate((300, 540, 780)):
            u = back_out(prog(t, 2.9 + i * 0.35, 3.3 + i * 0.35))
            if u > 0:
                draw_heart(d, x, 480, 50 * u * (1 + 0.12 * beat(t, 90, i * 0.2)))


GILL_L, GILL_R = (-1, 1)


def gill_points(cx, cy, s, side):
    gx, gy = cx + side * 170 * s, cy - 120 * s
    return gx, gy


def draw_gill(d, gx, gy, s, t, side):
    for k in range(6):
        a = math.radians(-60 + k * 24) if side > 0 else math.radians(240 - k * 24)
        L = 60 * s * (1 + 0.08 * math.sin(t * 4 + k))
        d.line([(gx, gy), (gx + L * math.cos(a), gy + L * math.sin(a))], fill=(255, 130, 160), width=int(10 * s))
    d.ellipse((gx - 18 * s, gy - 18 * s, gx + 18 * s, gy + 18 * s), fill=(255, 110, 150))


DEOX = (120, 110, 170)
OXY = (60, 200, 255)


def scene_schematic(img, d, t, part):
    """part 2: gill hearts (5–15 s); part 3: systemic heart (15–22 s)."""
    cx, cy, s = W / 2, 1000, 1.6
    layer, tent = octo_layer(t, 0.42, cx=cx, cy=cy, s=s, spread=1.05, amp=0.6, blink=False, smile=False)
    img.paste(layer, (0, 0), layer)
    # outline grid feel
    d.rounded_rectangle((60, 520, W - 60, 1500), radius=40, outline=(150, 220, 255, 90), width=4)
    gl = gill_points(cx, cy, s, -1)
    gr = gill_points(cx, cy, s, 1)
    main = (cx, cy - 175 * s)
    hl = (cx - 95 * s, cy - 95 * s)
    hr = (cx + 95 * s, cy - 95 * s)
    if part == 2:
        t0 = 5.0
        lt = t - t0
        pop_text(d, "2 ЖАБЕРНЫХ СЕРДЦА", W / 2, 300, 70, t, t0 + 0.2, fill=(255, 214, 64), stroke=(20, 30, 70))
        for g, side in ((gl, -1), (gr, 1)):
            draw_gill(d, g[0], g[1], s, t, side)
        text(d, "жабры", gl[0] - 10, gl[1] - 130, 46, fill=(255, 180, 200), alpha=255 * prog(t, t0 + 1.5, t0 + 2))
        text(d, "жабры", gr[0] + 10, gr[1] - 130, 46, fill=(255, 180, 200), alpha=255 * prog(t, t0 + 1.5, t0 + 2))
        # flow: body -> gill heart -> gill -> main heart
        if lt > 2.2:
            for side, h, g in ((-1, hl, gl), (1, hr, gr)):
                path_in = [(cx + side * 60 * s, cy + 60 * s), (h[0], h[1] + 30)]
                path_out = bezier(h, (h[0] + side * 60, h[1] - 40), (g[0], g[1] + 40), g, 12)
                path_back = bezier(g, (g[0] - side * 20, g[1] - 140), (main[0] + side * 120, main[1] - 60), main, 16)
                for pth, col in ((path_in, DEOX), (path_out, DEOX), (path_back, OXY)):
                    d.line(pth, fill=col + (110,), width=8)
                for k in range(5):
                    u = ((t * 0.5 + k / 5) % 1.0)
                    for pth, col in ((path_in, DEOX), (path_out, DEOX), (path_back, OXY)):
                        px, py = along(pth, u)
                        d.ellipse((px - 11, py - 11, px + 11, py + 11), fill=col)
            a = 255 * prog(t, t0 + 3.5, t0 + 4)
            text(d, "без O₂", 210, 1420, 50, fill=DEOX, stroke=(10, 10, 30), alpha=a)
            text(d, "с O₂", 870, 1420, 50, fill=OXY, stroke=(10, 10, 30), alpha=a)
        for i, h in enumerate((hl, hr)):
            u = back_out(prog(t, t0 + 0.6 + 0.3 * i, t0 + 1.1 + 0.3 * i))
            if u > 0:
                b = beat(t, 85, 0.1 * i)
                draw_heart(d, h[0], h[1], 46 * u * (1 + 0.18 * b), glow=b)
        # dim main heart
        draw_heart(d, main[0], main[1], 52, fill=(150, 150, 170, 150), outline=(90, 90, 110, 150))
    else:
        t0 = 15.0
        pop_text(d, "ГЛАВНОЕ СЕРДЦЕ", W / 2, 300, 96, t, t0 + 0.3, fill=(255, 214, 64), stroke=(20, 30, 70))
        pop_text(d, "качает кровь по всему телу", W / 2, 410, 50, t, t0 + 1.0, fill=(255, 255, 255))
        for h in (hl, hr):
            draw_heart(d, h[0], h[1], 40 * (1 + 0.1 * beat(t, 85)), fill=(200, 70, 90, 170), outline=(110, 20, 40, 170))
        b = beat(t, 85)
        size = 60 * back_out(prog(t, t0, t0 + 0.6)) * (1 + 0.22 * b)
        # arrows radiating along tentacles
        if t > t0 + 1.2:
            for idx, pts in tent:
                path = [main, (cx + (idx - 3.5) / 3.5 * 60 * s, cy + 50 * s)] + pts[1:16]
                d.line(path, fill=OXY + (90,), width=7)
                for k in range(4):
                    u = (t * 0.55 + k / 4 + idx * 0.07) % 1.0
                    px, py = along(path, u)
                    d.ellipse((px - 10, py - 10, px + 10, py + 10), fill=OXY)
                end = path[-1]
                prev = path[-3]
                arrow(d, prev, end, OXY, w=6, head=26)
        draw_heart(d, main[0], main[1], size, glow=b)


def ecg_panel(d, t, active, y=200):
    x0, x1 = 120, W - 120
    d.rounded_rectangle((x0, y - 110, x1, y + 110), radius=30, fill=(10, 20, 40, 190), outline=(120, 200, 255, 160), width=4)
    hb = 1 + 0.2 * beat(t, 80) if active else 1.0
    draw_heart(d, x0 + 90, y, 46 * hb, fill=(235, 50, 70) if active else (120, 120, 130),
               outline=(120, 10, 30) if active else (60, 60, 70))
    pts = []
    for i in range(160):
        x = x0 + 170 + i * (x1 - x0 - 200) / 159
        yy = y
        if active:
            ph = ((x - t * 260) / 260) % 1.0
            if 0.4 < ph < 0.45:
                yy -= 70 * math.sin((ph - 0.4) / 0.05 * math.pi)
            elif 0.45 < ph < 0.5:
                yy += 35 * math.sin((ph - 0.45) / 0.05 * math.pi)
        pts.append((x, yy))
    d.line(pts, fill=(80, 255, 140) if active else (255, 80, 80), width=6)
    if not active and (t * 3) % 1 < 0.65:
        text(d, "СТОП!", (x0 + x1) / 2 + 60, y - 40, 76, fill=(255, 70, 70), stroke=(40, 0, 0))


def scene_swim(img, d, t):
    # 22–27.4 swim; 27.4–32 crawl
    if t < 27.4:
        u = prog(t, 22, 27.4)
        pulse = 0.5 + 0.5 * math.sin(t * 5)
        cx = lerp(380, 700, ease_io(u))
        cy = lerp(1500, 820, ease_io(u))
        draw_octopus(d, cx, cy, 1.15, t, spread=0.22 + 0.22 * pulse, amp=0.5, length=1.35, curl=0.35,
                     squash=1.0 + 0.08 * pulse, look=(0.4, -0.6), smile=False, wave_speed=5)
        # jet bubbles
        for k in range(6):
            bu = (t * 1.6 + k / 6) % 1.0
            bx, by = cx - 40 + 25 * math.sin(k * 3 + t), cy + 380 + bu * 300
            r = 10 + 6 * k % 3
            d.ellipse((bx - r, by - r, bx + r, by + r), outline=(220, 245, 255, int(200 * (1 - bu))), width=3)
        ecg_panel(d, t, active=False)
        pop_text(d, "плывёт → сердце стоп", W / 2, 400, 56, t, 23.0, fill=(255, 214, 64))
    else:
        draw_seabed(d, t)
        u = prog(t, 27.4, 32)
        cx = lerp(250, 760, u)
        bob = 12 * math.sin(t * 6)
        draw_octopus(d, cx, 1180 + bob, 1.05, t, spread=1.35, amp=1.1, length=1.05, curl=-0.6,
                     wave_speed=6, look=(0.7, 0.3), droop=0.2)
        ecg_panel(d, t, active=True)
        pop_text(d, "лучше ползти по дну", W / 2, 400, 60, t, 28.0, fill=(255, 214, 64))


def flask(d, cx, cy, r, liquid, t, level=0.65, label=None):
    neck_w = r * 0.42
    d.rectangle((cx - neck_w, cy - r * 2.0, cx + neck_w, cy - r * 0.6), fill=(200, 230, 255, 50), outline=(230, 245, 255), width=6)
    # liquid inside round bottom
    top = cy + r - 2 * r * level
    pts = []
    for k in range(40):
        x = cx - r + 2 * r * k / 39
        pts.append((x, top + 8 * math.sin(t * 3 + k * 0.4)))
    mask = Image.new("L", (int(2 * r) + 2, int(2 * r) + 2), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse((0, 0, 2 * r, 2 * r), fill=255)
    liq = Image.new("L", mask.size, 0)
    ld = ImageDraw.Draw(liq)
    ld.polygon([(p[0] - (cx - r), p[1] - (cy - r)) for p in pts] + [(2 * r, 2 * r), (0, 2 * r)], fill=255)
    from PIL import ImageChops
    m = ImageChops.multiply(mask, liq)
    solid = Image.new("RGB", mask.size, liquid)
    img = d._image
    img.paste(solid, (int(cx - r), int(cy - r)), m)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(230, 245, 255), width=8)
    d.ellipse((cx - r * 0.65, cy - r * 0.6, cx - r * 0.35, cy - r * 0.1), fill=(255, 255, 255, 110))
    for k in range(5):
        bu = (t * 0.6 + k / 5) % 1.0
        bx = cx - r * 0.5 + (k * 0.27 % 1) * r
        by = cy + r * 0.8 - bu * (cy + r * 0.8 - top)
        d.ellipse((bx - 8, by - 8, bx + 8, by + 8), outline=(255, 255, 255, 170), width=3)
    if label:
        text(d, label, cx, cy + r + 70, 52)


def element_tile(d, cx, cy, sym, num, name, col, sc=1.0):
    w, h = 200 * sc, 230 * sc
    d.rounded_rectangle((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), radius=24 * sc, fill=col, outline=(255, 255, 255), width=6)
    text(d, str(num), cx - w / 2 + 34 * sc, cy - h / 2 + 32 * sc, 34 * sc, sw=0)
    text(d, sym, cx, cy - 5 * sc, 110 * sc, sw=int(4 * sc))
    text(d, name, cx, cy + h / 2 - 34 * sc, 36 * sc, sw=0)


def scene_blood(img, d, t):
    BLUE = (40, 140, 255)
    RED = (215, 35, 50)
    if t < 35.4:
        pop_text(d, "ГОЛУБАЯ КРОВЬ", W / 2, 300, 104, t, 32.2, fill=(120, 210, 255), stroke=(10, 20, 60))
        lvl = 0.15 + 0.6 * ease_out(prog(t, 32.3, 34.3))
        flask(d, W / 2, 1000, 230, BLUE, t, level=lvl)
        u = back_out(prog(t, 33.0, 33.5))
        if u > 0:
            element_tile(d, W / 2, 560, "Cu", 29, "медь", (190, 110, 60), sc=u)
            pop_text(d, "Cu — медь", W / 2, 1380, 92, t, 33.4, fill=(255, 190, 120), stroke=(60, 25, 5))
    elif t < 39.6:
        pop_text(d, "Кто переносит O₂?", W / 2, 300, 80, t, 35.5, fill=(255, 214, 64))
        a = back_out(prog(t, 35.6, 36.1))
        b = back_out(prog(t, 37.4, 37.9))
        if a > 0:
            element_tile(d, 280, 560, "Fe", 26, "железо", (120, 120, 135), sc=a)
            flask(d, 280, 1030, 170 * a, RED, t, level=0.6, label="человек")
        if b > 0:
            element_tile(d, 800, 560, "Cu", 29, "медь", (190, 110, 60), sc=b)
            flask(d, 800, 1030, 170 * b, BLUE, t, level=0.6, label="осьминог")
        text(d, "vs", W / 2, 1000, 70, fill=(255, 255, 255), alpha=255 * prog(t, 37.3, 37.6))
    else:
        # cold water
        d.rectangle((0, 0, W, H), fill=(170, 220, 255, 40))
        for (x0, y0, r, sp, ph) in SNOW:
            y = (y0 + t * sp) % (H + 60) - 30
            x = x0 + 30 * math.sin(t + ph)
            for k in range(3):
                a = ph + k * math.pi / 3
                d.line([(x - r * math.cos(a), y - r * math.sin(a)), (x + r * math.cos(a), y + r * math.sin(a))],
                       fill=(235, 250, 255, 200), width=3)
        pop_text(d, "ХОЛОДНО", W / 2, 290, 110, t, 39.8, fill=(190, 240, 255), stroke=(10, 40, 90))
        pop_text(d, "и мало кислорода", W / 2, 410, 60, t, 40.6, fill=(255, 255, 255))
        # thermometer
        tx, ty = 170, 1000
        d.rounded_rectangle((tx - 26, ty - 300, tx + 26, ty + 120), radius=26, fill=(240, 250, 255), outline=(60, 90, 140), width=5)
        d.ellipse((tx - 55, ty + 80, tx + 55, ty + 190), fill=(40, 140, 255), outline=(60, 90, 140), width=5)
        lvl = lerp(-150, 60, ease_out(prog(t, 39.8, 41.0)))
        d.rectangle((tx - 14, ty + lvl, tx + 14, ty + 110), fill=(40, 140, 255))
        text(d, "+2°", tx, ty - 360, 56, fill=(190, 240, 255))
        # sparse O2 bubbles
        for k in range(3):
            bu = (t * 0.25 + k / 3) % 1.0
            bx, by = 870 + 40 * math.sin(k * 2 + t), 1450 - bu * 900
            d.ellipse((bx - 42, by - 42, bx + 42, by + 42), outline=(220, 245, 255, 220), width=5)
            text(d, "O₂", bx, by, 34, sw=0)
        draw_octopus(d, 540, 1150, 0.95, t, spread=1.0, amp=0.8, look=(0.2, 0))
        # blue heart glow on octopus: blood flows fine
        draw_heart(d, 540, 870, 34 * (1 + 0.15 * beat(t, 80)), fill=(40, 140, 255), outline=(10, 40, 120))


def draw_jar(d, cx, cy, t, lid_y=0.0, lid_rot=0.0, show_lid=True):
    w, h = 300, 380
    # contents: little crab
    kx, ky = cx, cy + 90
    d.ellipse((kx - 70, ky - 40, kx + 70, ky + 40), fill=(230, 80, 60))
    for sgn in (-1, 1):
        d.ellipse((kx + sgn * 95 - 26, ky - 70, kx + sgn * 95 + 26, ky - 30), fill=(230, 80, 60))
        d.line([(kx + sgn * 50, ky - 10), (kx + sgn * 90, ky - 45)], fill=(230, 80, 60), width=12)
        d.ellipse((kx + sgn * 22 - 8, ky - 62, kx + sgn * 22 + 8, ky - 46), fill=(20, 20, 20))
    d.rounded_rectangle((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), radius=50, fill=(200, 235, 255, 60),
                        outline=(230, 248, 255, 230), width=7)
    d.rounded_rectangle((cx - w / 2 + 30, cy - h / 2 + 40, cx - w / 2 + 55, cy + h / 2 - 60), radius=12, fill=(255, 255, 255, 90))
    if show_lid:
        ly = cy - h / 2 - 40 - lid_y
        lw = 170
        d.rounded_rectangle((cx - lw, ly - 34, cx + lw, ly + 34), radius=14, fill=(230, 190, 60), outline=(150, 110, 20), width=5)
        for k in range(9):
            x = cx - lw + ((k * 40 + lid_rot * 60) % (2 * lw))
            d.line([(x, ly - 30), (x, ly + 30)], fill=(170, 130, 30), width=5)
    return cx, cy - h / 2 - 40


def scene_jar(img, d, t):
    jx, jy = 640, 1180
    twist = prog(t, 45.3, 47.9)
    popped = t >= 47.9
    lid_y = 0 if not popped else 1400 * prog(t, 47.9, 48.8) ** 1.4
    lid_rot = t * 6 if not popped else 0
    lx, ly = draw_jar(d, jx, jy, t, lid_y=lid_y, lid_rot=lid_rot, show_lid=True)
    ocx, ocy = 300, 880
    tent = draw_octopus(d, ocx, ocy, 1.0, t, spread=0.9, amp=0.9, skip=(5, 6), look=(1, 0.3))
    # two tentacles to the lid
    for k, (off, ph) in enumerate(((-120, 0.0), (120, 1.6))):
        start = (ocx + 40 + 30 * k, ocy + 40)
        wig = 30 * math.sin(t * 8 + ph) * (1 - popped)
        end = (lx + off * 0.9 + wig, ly - lid_y + 10) if not popped else (lx + off * 0.6, ly - 40)
        pts = bezier(start, (start[0] + 160, start[1] - 160), (end[0] - 40, end[1] - 200), end, 22)
        for i in range(len(pts) - 1):
            w = lerp(32, 8, i / len(pts))
            d.line([pts[i], pts[i + 1]], fill=OCT, width=int(w))
            d.ellipse((pts[i + 1][0] - w / 2, pts[i + 1][1] - w / 2, pts[i + 1][0] + w / 2, pts[i + 1][1] + w / 2), fill=OCT)
    if not popped:
        a = (t * 10) % 1 < 0.5
        text(d, "↻", lx + 230, ly - 10, 80, fill=(255, 255, 255) if a else (255, 214, 64))
    if t >= 48.0:
        # nine brains: one central + one per arm
        g = back_out(prog(t, 48.0, 48.5))
        spots = [(ocx, ocy - 150)] + [pts[7] for _, pts in tent]
        spots += [(ocx + 140, ocy - 80), (ocx + 240, ocy - 140)]
        for i, (px, py) in enumerate(spots[:9]):
            gl = 0.6 + 0.4 * math.sin(t * 6 + i)
            r = (22 if i else 36) * g
            d.ellipse((px - r * 1.8, py - r * 1.8, px + r * 1.8, py + r * 1.8), fill=(255, 140, 220, int(70 * gl)))
            d.ellipse((px - r, py - r, px + r, py + r), fill=(255, 170, 230), outline=(200, 70, 160), width=4)
        pop_text(d, "9 МОЗГОВ?", W / 2, 300, 140, t, 48.0, fill=(255, 150, 230), stroke=(70, 10, 60))
    else:
        pop_text(d, "3 сердца · голубая кровь", W / 2, 300, 62, t, 45.3, fill=(255, 214, 64))
    if t > 50.4:
        pop_text(d, "в следующем видео →", W / 2, 440, 58, t, 50.4, fill=(255, 255, 255))


def scene_outro(img, d, t):
    lt = t - 53.0
    u = back_out(prog(t, 53.0, 53.6))
    cx, cy = W / 2, 640
    r = 230 * u
    if r > 0:
        for k in range(5, 0, -1):
            d.ellipse((cx - r - k * 14, cy - r - k * 14, cx + r + k * 14, cy + r + k * 14), fill=(255, 214, 64, 22))
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(20, 70, 140), outline=(255, 214, 64), width=12)
        draw_octopus(d, cx, cy + 40 * u, 0.62 * u, t, spread=1.0, amp=0.9, look=(0, 0))
        # stopwatch tick ring
        for k in range(12):
            a = k / 12 * 2 * math.pi
            d.line([(cx + (r - 6) * math.sin(a), cy - (r - 6) * math.cos(a)),
                    (cx + (r - 30) * math.sin(a), cy - (r - 30) * math.cos(a))], fill=(255, 214, 64), width=6)
    pop_text(d, "ФАКТЫ", W / 2, 990, 120, t, 53.4, fill=(255, 214, 64), stroke=(60, 30, 0))
    pop_text(d, "ЗА МИНУТУ", W / 2, 1110, 96, t, 53.6, fill=(255, 255, 255))
    # subscribe button
    bu = back_out(prog(t, 54.2, 54.7))
    if bu > 0:
        subscribed = t > 56.6
        press = 1 - 0.08 * math.exp(-((t - 56.5) / 0.1) ** 2)
        bw, bh = 330 * bu * press, 80 * bu * press
        by = 1330
        col = (110, 110, 120) if subscribed else (230, 30, 40)
        d.rounded_rectangle((W / 2 - bw, by - bh, W / 2 + bw, by + bh), radius=bh, fill=col)
        text(d, "ПОДПИСАНЫ ✓" if subscribed else "ПОДПИСАТЬСЯ", W / 2, by, 60 * bu, sw=0)
        # bell
        bx, byy = W / 2 + bw + 90, by
        sw = 0.5 * math.sin((t - 56.7) * 25) * math.exp(-(t - 56.7) * 2) if t > 56.7 else 0
        bell = [(bx - 40, byy + 30), (bx - 32, byy - 20), (bx, byy - 48), (bx + 32, byy - 20), (bx + 40, byy + 30)]
        bell = [(bx + (x - bx) * math.cos(sw) - (y - byy) * math.sin(sw), byy + (x - bx) * math.sin(sw) + (y - byy) * math.cos(sw))
                for x, y in bell]
        if bu > 0.9:
            d.polygon(bell, fill=(255, 214, 64))
            d.ellipse((bx - 10, byy + 28, bx + 10, byy + 48), fill=(255, 214, 64))
        # cursor
        cu = ease_io(prog(t, 55.4, 56.4))
        px, py = lerp(900, W / 2 + 60, cu), lerp(1700, by + 20, cu)
        if t > 55.2:
            hand = [(px, py), (px, py + 90), (px + 22, py + 68), (px + 40, py + 108), (px + 56, py + 100), (px + 38, py + 62), (px + 68, py + 62)]
            d.polygon(hand, fill=(255, 255, 255), outline=(0, 0, 0))
            d.line(hand + [hand[0]], fill=(0, 0, 0), width=5)
        if 56.45 < t < 57.1:
            rr = 30 + 200 * prog(t, 56.45, 57.1)
            d.ellipse((W / 2 + 60 - rr, by + 20 - rr, W / 2 + 60 + rr, by + 20 + rr), outline=(255, 255, 255, int(220 * (1 - prog(t, 56.45, 57.1)))), width=6)


def render_frame(i):
    global BG
    if BG is None:
        BG = make_bg()
    t = i / FPS
    img = BG.copy()
    d = ImageDraw.Draw(img, "RGBA")
    draw_ambient(d, t, rays=not (39.6 <= t < 45))
    if t < 5:
        scene_hook(img, d, t)
    elif t < 15:
        scene_schematic(img, d, t, 2)
    elif t < 22:
        scene_schematic(img, d, t, 3)
    elif t < 32:
        scene_swim(img, d, t)
    elif t < 45:
        scene_blood(img, d, t)
    elif t < 53:
        scene_jar(img, d, t)
    else:
        scene_outro(img, d, t)
    draw_subs(d, t)
    # channel watermark
    text(d, "Факты за минуту", W - 200, 80, 34, fill=(255, 255, 255), alpha=150, sw=2)
    # transitions: quick flash-to-dark around scene cuts
    fade = 0.0
    for c in (5, 15, 22, 32, 45, 53):
        fade = max(fade, 1 - abs(t - c) / 0.18)
    fade = max(fade, 1 - t / 0.25, 1 - (DUR - t) / 0.4)
    if fade > 0:
        d.rectangle((0, 0, W, H), fill=(0, 0, 0, int(255 * clamp(fade))))
    return img.tobytes()


def main():
    out = sys.argv[1]
    only = sys.argv[2:]  # optional list of times to dump stills
    if only:
        for s in only:
            i = int(float(s) * FPS)
            Image.frombytes("RGB", (W, H), render_frame(i)).save(f"{out}_{s}.png")
        return
    n = int(DUR * FPS)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "19",
                           "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
    with Pool(4) as pool:
        for k, fr in enumerate(pool.imap(render_frame, range(n), chunksize=8)):
            ff.stdin.write(fr)
            if k % 150 == 0:
                print(f"frame {k}/{n}", flush=True)
    ff.stdin.close()
    ff.wait()


if __name__ == "__main__":
    main()
