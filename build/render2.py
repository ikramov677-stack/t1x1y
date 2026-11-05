"""Part 2 short: «9 мозгов осьминога». Reuses the drawing kit from render.py.

Usage: python3 render2.py out.mp4            -> full video (no audio)
       python3 render2.py stills/x 3 12 ...   -> PNG stills at given seconds
Also writes the SFX event list consumed by audio2.py: python3 render2.py --events
"""
import json
import math
import subprocess
import sys
from multiprocessing import Pool

from PIL import Image, ImageDraw

import render as R
from render import (W, H, FPS, OCT, OCT_DARK, OCT_LIGHT, clamp, prog, ease_out, ease_io, back_out, lerp, text,
                    pop_text, bezier, draw_octopus, octo_layer, draw_seabed, draw_ambient, beat)

DUR = 60.0

# ------------------------------------------------------------------ voice / subtitles
# Script slots (start, end, line). When the real voiceover arrives these get re-timed.
SLOTS = [
    (0, 5, "В прошлом видео я обещал рассказать про девять мозгов осьминога. Держите!"),
    (5, 15, "Один главный мозг находится в голове. А ещё в каждом из восьми щупалец есть свой нервный центр — как маленький мозг."),
    (15, 24, "У осьминога около 500 миллионов нейронов. И примерно две трети из них — не в голове, а в щупальцах!"),
    (24, 35, "Поэтому щупальца могут «думать» сами: искать еду, ощупывать предметы и даже пробовать их на вкус — пока главный мозг занят другим."),
    (35, 45, "Неудивительно, что осьминоги так умны. Они умеют откручивать крышки банок — даже изнутри!"),
    (45, 53, "А некоторые носят с собой скорлупу кокоса и прячутся в ней, как в переносном домике."),
    (53, 60, "Подписывайтесь на «Факты за минуту» — завтра новый удивительный факт!"),
]
R.VO = [(a + 0.25, b - a - 0.7, line) for a, b, line in SLOTS]
R.CHUNKS = R.build_chunks()
CUTS = (5, 15, 24, 35, 45, 53)

# SFX events (time, kind) — collected statically for the audio mixer
SFX = [(0.15, "boom"), (0.9, "pop")] + [(c - 0.15, "whoosh") for c in CUTS]

PINK = (255, 150, 215)
PINK_D = (190, 60, 150)
YEL = (255, 214, 64)
NERVE = (255, 235, 120)


# ------------------------------------------------------------------ primitives
def brain(d, cx, cy, r, glow=0.0, col=PINK, line=PINK_D):
    if r <= 1:
        return
    if glow > 0:
        for k in range(4, 0, -1):
            rr = r * (1 + 0.25 * k * glow)
            d.ellipse((cx - rr * 1.15, cy - rr * 0.95, cx + rr * 1.15, cy + rr * 0.95), fill=col + (int(35 * glow),))
    d.ellipse((cx - r * 1.15, cy - r * 0.9, cx + r * 1.15, cy + r * 0.9), fill=col, outline=line, width=max(2, int(r * 0.1)))
    w = max(2, int(r * 0.09))
    d.line([(cx, cy - r * 0.85), (cx, cy + r * 0.8)], fill=line, width=w)
    for sx in (-1, 1):
        d.arc((cx + sx * r * 0.55 - r * 0.35, cy - r * 0.65, cx + sx * r * 0.55 + r * 0.35, cy - r * 0.05), 200, 340, fill=line, width=w)
        d.arc((cx + sx * r * 0.5 - r * 0.4, cy - r * 0.1, cx + sx * r * 0.5 + r * 0.4, cy + r * 0.6), 20, 160, fill=line, width=w)
        d.arc((cx + sx * r * 0.2 - r * 0.25, cy - r * 0.35, cx + sx * r * 0.2 + r * 0.25, cy + r * 0.25), 90, 270 if sx < 0 else 450, fill=line, width=w)
    d.ellipse((cx - r * 0.8, cy - r * 0.7, cx - r * 0.45, cy - r * 0.45), fill=(255, 255, 255, 150))


def node(d, x, y, r, on, t, i=0):
    if on <= 0:
        return
    g = (0.6 + 0.4 * math.sin(t * 7 + i)) * on
    d.ellipse((x - r * 2.2, y - r * 2.2, x + r * 2.2, y + r * 2.2), fill=NERVE + (int(70 * g),))
    d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 245, 190), outline=(230, 150, 30), width=4)


def bubble_label(d, x, y, s, size, t, t0, col=(255, 255, 255)):
    if t < t0:
        return
    u = back_out(prog(t, t0, t0 + 0.35))
    f = R.font(size * u)
    bb = d.textbbox((x, y), s, font=f, anchor="mm")
    pad = 22 * u
    d.rounded_rectangle((bb[0] - pad, bb[1] - pad * 0.8, bb[2] + pad, bb[3] + pad * 0.8), radius=24 * u, fill=col + (235,),
                        outline=(20, 30, 60), width=4)
    d.polygon([(x - 14 * u, bb[3] + pad * 0.8 - 2), (x + 14 * u, bb[3] + pad * 0.8 - 2), (x, bb[3] + pad * 0.8 + 26 * u)],
              fill=col + (235,))
    d.text((x, y), s, font=f, anchor="mm", fill=(20, 30, 60))


def tentacle_path(d, pts, w0=32, w1=7, col=OCT, suckers=True):
    n = len(pts) - 1
    for i in range(n):
        w = lerp(w0, w1, i / n)
        d.line([pts[i], pts[i + 1]], fill=col, width=int(w) + 1)
        d.ellipse((pts[i + 1][0] - w / 2, pts[i + 1][1] - w / 2, pts[i + 1][0] + w / 2, pts[i + 1][1] + w / 2), fill=col)
    if suckers:
        for i in range(2, n - 2, 3):
            w = lerp(w0, w1, i / n) * 0.25
            x, y = pts[i]
            d.ellipse((x - w, y - w, x + w, y + w), fill=OCT_LIGHT)


def wiggle(pts, t, amp=10, ph=0.0):
    out = []
    n = len(pts)
    for i, (x, y) in enumerate(pts):
        v = i / max(1, n - 1)
        out.append((x + amp * v * math.sin(t * 5 + i * 0.5 + ph), y + amp * v * math.cos(t * 4 + i * 0.4 + ph)))
    return out


def fmt_int(n):
    return f"{int(n):,}".replace(",", " ")


# ------------------------------------------------------------------ scenes
def scene_hook(img, d, t):
    # dark dramatic spotlight
    d.rectangle((0, 0, W, H), fill=(0, 0, 20, 120))
    for k in range(6, 0, -1):
        r = 300 + k * 70
        d.ellipse((W / 2 - r, 1050 - r, W / 2 + r, 1050 + r), fill=(80, 170, 230, 14))
    z = lerp(0.9, 1.7, ease_out(prog(t, 0, 4.5)))
    draw_octopus(d, W / 2, 1130, z, t, look=(0.5 * math.sin(t * 2), -0.4), amp=1.2)
    # nine brains circling
    n_on = int(clamp((t - 1.6) / 0.25, 0, 9))
    for i in range(n_on):
        a = i / 9 * 2 * math.pi + t * 0.8
        x, y = W / 2 + 400 * math.cos(a), 1050 + 470 * math.sin(a)
        u = back_out(prog(t, 1.6 + i * 0.25, 1.95 + i * 0.25))
        brain(d, x, y, 42 * u, glow=0.5)
    # slam title
    if t > 0.15:
        u = prog(t, 0.15, 0.45)
        size = lerp(300, 128, ease_out(u))
        jit = 8 * math.sin(t * 60) * (1 - prog(t, 0.45, 1.0))
        text(d, "9 МОЗГОВ?!", W / 2 + jit, 300, size, fill=PINK, stroke=(60, 0, 50), alpha=255 * clamp(u * 3))
    pop_text(d, "часть 2", W / 2, 440, 54, t, 0.9, fill=YEL)


def scene_schematic(img, d, t):
    t0 = 5.0
    cx, cy, s = W / 2, 1000, 1.65
    layer, tent = octo_layer(t, 0.45, cx=cx, cy=cy, s=s, spread=1.35, amp=0.6, blink=False, smile=False)
    img.paste(layer, (0, 0), layer)
    d.rounded_rectangle((60, 520, W - 60, 1500), radius=40, outline=(150, 220, 255, 90), width=4)
    head = (cx, cy - 165 * s)
    # main brain
    gb = back_out(prog(t, t0 + 0.4, t0 + 0.9))
    brain(d, head[0], head[1], 70 * gb * (1 + 0.05 * math.sin(t * 5)), glow=0.8)
    pop_text(d, "ГЛАВНЫЙ МОЗГ", W / 2, 300, 88, t, t0 + 0.3, fill=PINK, stroke=(60, 0, 50))
    if t > t0 + 1.3:
        bubble_label(d, head[0] + 250, head[1] - 90, "1", 60, t, t0 + 1.3, col=PINK)
    # nerve centers, lit one per 0.45 s
    tstart = t0 + 4.2
    if t > tstart - 0.5:
        pop_text(d, "+ 8 мини-мозгов", W / 2, 410, 62, t, tstart - 0.4, fill=NERVE)
    lit = 0
    for k, (idx, pts) in enumerate(sorted(tent, key=lambda p: p[0])):
        on = prog(t, tstart + k * 0.45, tstart + k * 0.45 + 0.3)
        nx, ny = pts[10]
        if on > 0:
            lit += 1
            path = [head, (cx + (idx - 3.5) / 3.5 * 40 * s, cy + 30 * s)] + pts[1:11]
            d.line(path, fill=NERVE + (int(200 * on),), width=6)
            # signal pulses
            for j in range(2):
                u = (t * 0.9 + j / 2 + idx * 0.11) % 1.0
                px, py = R.along(path, u)
                d.ellipse((px - 9, py - 9, px + 9, py + 9), fill=(255, 255, 255, int(230 * on)))
            node(d, nx, ny, 20 * back_out(on), on, t, idx)
            # nerve cord continuing to tip
            d.line(pts[10:19], fill=NERVE + (int(110 * on),), width=4)
    if t > tstart:
        total = 1 + lit
        size = 170 if lit < 8 else 170 + 30 * math.sin(clamp(t - (tstart + 3.4)) * math.pi)
        text(d, f"{total}", W - 170, 1380, size, fill=YEL if total < 9 else PINK, stroke=(40, 20, 0))
        text(d, "мозгов", W - 170, 1470, 40, fill=(255, 255, 255))


def scene_neurons(img, d, t):
    t0 = 15.0
    lt = t - t0
    # rolling counter
    cnt = 500_000_000 * ease_out(prog(t, t0 + 0.3, t0 + 2.6))
    y_num = 520 if lt < 3.6 else lerp(520, 330, ease_io(prog(t, t0 + 3.6, t0 + 4.2)))
    sc = 1 + 0.08 * math.exp(-((lt - 2.65) / 0.12) ** 2)
    text(d, fmt_int(cnt), W / 2, y_num, 112 * sc, fill=YEL, stroke=(60, 30, 0))
    pop_text(d, "нейронов", W / 2, y_num + 100, 56, t, t0 + 0.5)
    # neuron dots: 30 dots -> 10 to head, 20 to tentacles
    cx, cy = W / 2, 1180
    split = ease_io(prog(t, t0 + 4.0, t0 + 5.6))
    if lt > 3.0:
        app = prog(t, t0 + 3.0, t0 + 3.6)
        draw_octopus(d, cx, cy, 1.15, t, spread=1.1, amp=0.7, look=(0, -0.5))
        head = (cx, cy - 190)
        for i in range(30):
            gx = 210 + (i % 10) * 73
            gy = 760 + (i // 10) * 80
            if i < 10:
                tx, ty = head[0] - 90 + (i % 5) * 45, head[1] - 30 + (i // 5) * 60
            else:
                k = i - 10
                a = math.pi / 2 + ((k % 8) - 3.5) / 3.5 * 1.1
                rr = 260 + (k // 8) * 110
                tx, ty = cx + rr * math.cos(a) * 1.1, cy + 40 + rr * math.sin(a) * 0.9
            x, y = lerp(gx, tx, split), lerp(gy, ty, split) - 60 * math.sin(split * math.pi)
            col = PINK if i < 10 else NERVE
            r = 15 * app
            d.ellipse((x - r * 1.8, y - r * 1.8, x + r * 1.8, y + r * 1.8), fill=col + (60,))
            d.ellipse((x - r, y - r, x + r, y + r), fill=col, outline=(40, 20, 40), width=3)
    if lt > 5.6:
        # donut chart
        dx, dy, rr = 900, 640, 85
        u = ease_out(prog(t, t0 + 5.6, t0 + 6.6))
        d.ellipse((dx - rr, dy - rr, dx + rr, dy + rr), fill=(20, 30, 60, 200))
        d.pieslice((dx - rr, dy - rr, dx + rr, dy + rr), -90, -90 + 240 * u, fill=NERVE)
        d.pieslice((dx - rr, dy - rr, dx + rr, dy + rr), -90 + 240, -90 + 240 + 120 * u, fill=PINK)
        d.ellipse((dx - rr * 0.5, dy - rr * 0.5, dx + rr * 0.5, dy + rr * 0.5), fill=(15, 35, 75))
        pop_text(d, "⅔ — в щупальцах!", 420, 640, 62, t, t0 + 5.8, fill=NERVE, stroke=(60, 40, 0))
        pop_text(d, "⅓ в голове", 900, 770, 40, t, t0 + 6.4, fill=PINK)


def scene_explore(img, d, t):
    t0 = 24.0
    draw_seabed(d, t, y0=1420)
    cx, cy = W / 2, 1060
    targets = [
        ("еда?", lambda: (150 + 30 * math.sin(t), 1390), t0 + 0.8, -1),            # shell left
        ("ощупываю", lambda: (180, 960), t0 + 2.4, -1),                                # rock left high
        ("вкусно!", lambda: (lerp(980, 820, prog(t, t0, t0 + 6)), 1420), t0 + 4.0, 1),  # crab right
        ("что это?", lambda: (900, 900), t0 + 5.6, 1),                                  # coral right high
    ]
    # rock & coral & shell & crab props
    d.ellipse((90, 900, 290, 1030), fill=(95, 105, 125))
    for k in range(5):
        a = -math.pi / 2 + (k - 2) * 0.35
        d.line([(900, 1000), (900 + 120 * math.cos(a), 1000 + 160 * math.sin(a))], fill=(255, 120, 170), width=22)
    sx, sy = targets[0][1]()
    d.pieslice((sx - 50, sy - 45, sx + 50, sy + 45), 180, 360, fill=(250, 220, 200), outline=(170, 120, 100), width=4)
    kx, ky = targets[2][1]()
    d.ellipse((kx - 50, ky - 30, kx + 50, ky + 30), fill=(230, 80, 60))
    for sg in (-1, 1):
        d.ellipse((kx + sg * 70 - 20, ky - 55, kx + sg * 70 + 20, ky - 25), fill=(230, 80, 60))
        d.ellipse((kx + sg * 16 - 7, ky - 46, kx + sg * 16 + 7, ky - 32), fill=(20, 20, 20))
    draw_octopus(d, cx, cy, 1.0, t, spread=0.6, amp=0.8, skip=(0, 1, 6, 7), look=(0, -0.8))
    for k, (label, tgt, ts, side) in enumerate(targets):
        reach = ease_io(prog(t, ts - 0.9, ts))
        base = (cx + side * (55 + 20 * (k % 2)), cy + 45)
        tx, ty = tgt()
        rest = (cx + side * 230, cy + 260 - 60 * (k % 2))
        ex, ey = lerp(rest[0], tx, reach), lerp(rest[1], ty - 20, reach)
        c1 = (base[0] + side * 140, base[1] + 30 - 120 * (k % 2))
        c2 = (ex - side * 60, ey - 120)
        pts = wiggle(bezier(base, c1, c2, (ex, ey), 22), t, amp=12 * (1 - 0.6 * reach), ph=k)
        tentacle_path(d, pts, col=OCT_DARK if k % 2 else OCT)
        node(d, pts[7][0], pts[7][1], 13, 0.4 + 0.6 * reach, t, k)
        if reach >= 1:
            bubble_label(d, tx, ty - 120, label, 44, t, ts, col=(255, 255, 255))
    # main brain busy thought bubble
    if t > t0 + 6.8:
        u = back_out(prog(t, t0 + 6.8, t0 + 7.3))
        bx, by = cx + 170, cy - 470
        for j, (ox, oy, r) in enumerate(((60, 300, 14), (95, 250, 22))):
            d.ellipse((cx + ox - r * u, cy - oy - r * u, cx + ox + r * u, cy - oy + r * u), fill=(255, 255, 255, 230))
        d.ellipse((bx - 210 * u, by - 90 * u, bx + 210 * u, by + 90 * u), fill=(255, 255, 255, 235), outline=(20, 30, 60), width=4)
        brain(d, bx - 120 * u, by, 40 * u, glow=0)
        text(d, "я занят…", bx + 50 * u, by, 50 * u, fill=(20, 30, 60), sw=0)
    pop_text(d, "ЩУПАЛЬЦА ДУМАЮТ САМИ", W / 2, 300, 62, t, t0 + 0.2, fill=NERVE, stroke=(60, 40, 0))


def jar_glass(d, cx, cy, w, h):
    d.rounded_rectangle((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), radius=60, fill=(200, 235, 255, 70),
                        outline=(230, 248, 255, 240), width=8)
    d.rounded_rectangle((cx - w / 2 + 35, cy - h / 2 + 50, cx - w / 2 + 65, cy + h / 2 - 70), radius=14, fill=(255, 255, 255, 100))
    d.rounded_rectangle((cx + w / 2 - 60, cy - h / 2 + 80, cx + w / 2 - 45, cy - h / 2 + 260), radius=8, fill=(255, 255, 255, 70))


def rot_rect(cx, cy, w, h, a):
    pts = [(-w, -h), (w, -h), (w, h), (-w, h)]
    return [(cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)) for x, y in pts]


def scene_jar(img, d, t):
    t0 = 35.0
    jx, jy, jw, jh = W / 2, 1150, 440, 580
    top = jy - jh / 2
    pop_t = t0 + 5.6
    popped = t >= pop_t
    out = ease_io(prog(t, pop_t + 0.4, pop_t + 2.6))
    ocy = lerp(jy + 40, top - 150, out)
    sq = lerp(0.8, 1.0, out)
    # tentacles pushing the lid from inside
    lid_rise = 0 if not popped else 1500 * prog(t, pop_t, pop_t + 1.0) ** 1.5
    lid_y = top - 30 - lid_rise
    if not popped:
        for sx in (-1, 1):
            p0 = (jx + sx * 60, ocy - 150)
            p3 = (jx + sx * 130 + 15 * math.sin(t * 9 + sx), top + 30)
            tentacle_path(d, bezier(p0, (p0[0] + sx * 80, p0[1] - 60), (p3[0], p3[1] + 80), p3, 16), w0=26, w1=10)
    draw_octopus(d, jx, ocy, 0.8 * sq, t, spread=0.55 + 0.5 * out, amp=0.7, length=0.9, squash=1 / sq,
                 look=(0, -1), smile=popped)
    jar_glass(d, jx, jy, jw, jh)
    # lid
    lid_a = 0 if not popped else (t - pop_t) * 9
    twist = (t * 7) if not popped else 0
    d.polygon(rot_rect(jx, lid_y, 245, 40, lid_a), fill=(230, 190, 60), outline=(150, 110, 20))
    if not popped:
        for k in range(10):
            x = jx - 240 + ((k * 48 + twist * 40) % 480)
            d.line([(x, lid_y - 36), (x, lid_y + 36)], fill=(170, 130, 30), width=6)
        if t > t0 + 1.0:
            ph = (t * 3) % 1
            text(d, "↻", jx + 330, lid_y, 110 + 20 * ph, fill=YEL)
            text(d, "↺", jx - 330, lid_y, 110 + 20 * ph, fill=YEL)
    pop_text(d, "ОСЬМИНОГИ УМНЫЕ", W / 2, 300, 84, t, t0 + 0.2, fill=YEL, stroke=(60, 30, 0))
    if popped:
        u = prog(t, pop_t, pop_t + 0.5)
        for k in range(12):
            a = k / 12 * 2 * math.pi
            r0, r1 = 60 + 300 * u, 110 + 330 * u
            d.line([(jx + r0 * math.cos(a), top + r0 * math.sin(a) * 0.6), (jx + r1 * math.cos(a), top + r1 * math.sin(a) * 0.6)],
                   fill=(255, 255, 255, int(255 * (1 - u))), width=8)
        jit = 6 * math.sin(t * 50) * (1 - prog(t, pop_t, pop_t + 0.6))
        pop_text(d, "ИЗНУТРИ!", W / 2 + jit, 440, 130, t, pop_t, fill=PINK, stroke=(60, 0, 50))


def coconut_half(d, cx, cy, r, top=False, ang=0.0):
    a0, a1 = (180, 360) if top else (0, 180)
    a0 += ang
    a1 += ang
    d.pieslice((cx - r, cy - r, cx + r, cy + r), a0, a1, fill=(120, 75, 40), outline=(70, 40, 20), width=6)
    d.pieslice((cx - r * 0.86, cy - r * 0.86, cx + r * 0.86, cy + r * 0.86), a0, a1, fill=(245, 240, 225))
    d.pieslice((cx - r * 0.78, cy - r * 0.78, cx + r * 0.78, cy + r * 0.78), a0, a1, fill=(90, 55, 30))
    # fibers
    for k in range(7):
        a = math.radians(a0 + (a1 - a0) * (k + 0.5) / 7)
        d.line([(cx + r * 0.9 * math.cos(a), cy + r * 0.9 * math.sin(a)), (cx + r * 1.05 * math.cos(a), cy + r * 1.05 * math.sin(a))],
               fill=(70, 40, 20), width=4)


def scene_coconut(img, d, t):
    t0 = 45.0
    draw_seabed(d, t, y0=1420)
    close_t = t0 + 4.2
    walk = prog(t, t0, close_t)
    cx = lerp(220, 560, ease_io(walk))
    cy = 1150 + 14 * math.sin(t * 8) * (1 - prog(t, close_t - 0.3, close_t))
    r = 170
    if t < close_t:
        # stilt-walking, carrying the halves under the body
        for k, sx in enumerate((-1, 1)):
            ph = math.sin(t * 8 + k * math.pi)
            base = (cx + sx * 40, cy + 40)
            foot = (cx + sx * 110 + 40 * ph, 1420)
            tentacle_path(d, bezier(base, (base[0] + sx * 30, base[1] + 80), (foot[0], foot[1] - 120), foot, 16), w0=30, w1=12)
        draw_octopus(d, cx, cy - 60, 0.75, t, spread=0.3, amp=0.5, length=0.5, skip=(3, 4), look=(1, 0))
        coconut_half(d, cx - 10, cy + 110, r * 0.8, top=False)
        coconut_half(d, cx + 10, cy + 118, r * 0.8, top=False)
        pop_text(d, "носит скорлупу кокоса", W / 2, 300, 66, t, t0 + 0.4, fill=YEL)
    else:
        u = ease_out(prog(t, close_t, close_t + 0.7))
        bx, by = cx, 1250
        coconut_half(d, bx, by, r, top=False)
        # octopus ducks into the shell
        draw_octopus(d, bx, lerp(1090, by - 10, u), 0.62, t, spread=0.4, amp=0.4, length=0.5, look=(0.5, 0))
        coconut_half(d, bx, lerp(by - 420, by - 18, u), r, top=True, ang=lerp(-40, 0, u))
        if u >= 1:
            # eyes peek through the gap
            for sx in (-1, 1):
                ex = bx + sx * 32
                blink = (t % 2.2) < 0.12
                if not blink:
                    d.ellipse((ex - 18, by - 22, ex + 18, by - 2), fill=(255, 250, 235))
                    d.ellipse((ex - 6 + 6 * math.sin(t * 2), by - 18, ex + 6 + 6 * math.sin(t * 2), by - 6), fill=(30, 20, 30))
        pop_text(d, "ПЕРЕНОСНОЙ ДОМИК", W / 2, 300, 80, t, close_t + 0.3, fill=YEL, stroke=(60, 30, 0))
        if t > close_t + 0.9:
            # cartoon house roof over the shell
            hu = back_out(prog(t, close_t + 0.9, close_t + 1.3))
            d.polygon([(bx - 230 * hu, by - 190), (bx, by - 190 - 170 * hu), (bx + 230 * hu, by - 190)], outline=YEL, width=10)
            d.rectangle((bx + 110 * hu, by - 300 * hu, bx + 150 * hu, by - 220 * hu), outline=YEL, width=6)


def scene_outro(img, d, t):
    R.scene_outro(img, d, t)
    pop_text(d, "завтра — новый факт!", W / 2, 1490, 58, t, 54.5, fill=NERVE)


# ------------------------------------------------------------------ frame
SCENES = [(0, scene_hook), (5, scene_schematic), (15, scene_neurons), (24, scene_explore), (35, scene_jar),
          (45, scene_coconut), (53, scene_outro)]


def camera(img, t):
    z, dx, dy = 1.0, 0.0, 0.0
    for c in (0,) + CUTS:
        u = prog(t, c, c + 0.35)
        if 0 < u < 1:
            z = max(z, lerp(1.12, 1.0, ease_out(u)))
    # impacts
    for ts, amt in ((0.2, 22), (40.6, 18)):
        if ts <= t < ts + 0.5:
            k = (1 - (t - ts) / 0.5) * amt
            dx += k * math.sin(t * 90)
            dy += k * math.cos(t * 70)
    if z == 1.0 and dx == 0 and dy == 0:
        return img
    cw, ch = W / z, H / z
    x0 = (W - cw) / 2 + dx
    y0 = (H - ch) / 2 + dy
    return img.transform((W, H), Image.EXTENT, (x0, y0, x0 + cw, y0 + ch), Image.BILINEAR)


def render_frame(i):
    if R.BG is None:
        R.BG = R.make_bg()
    t = i / FPS
    img = R.BG.copy()
    d = ImageDraw.Draw(img, "RGBA")
    draw_ambient(d, t, rays=t >= 5)
    fn = [f for s, f in SCENES if t >= s][-1]
    fn(img, d, t)
    img = camera(img, t)
    d = ImageDraw.Draw(img, "RGBA")
    R.draw_subs(d, t)
    # progress bar + watermark
    d.rectangle((0, 0, W * t / DUR, 12), fill=YEL)
    text(d, "Факты за минуту", W - 200, 80, 34, fill=(255, 255, 255), alpha=150, sw=2)
    # white flash on cuts, fade at ends
    for c in CUTS:
        if c <= t < c + 0.12:
            d.rectangle((0, 0, W, H), fill=(255, 255, 255, int(150 * (1 - (t - c) / 0.12))))
    fade = max(1 - t / 0.2, 1 - (DUR - t) / 0.4, 0)
    if fade > 0:
        d.rectangle((0, 0, W, H), fill=(0, 0, 0, int(255 * clamp(fade))))
    return img.tobytes()


def events():
    ev = list(SFX)
    for k in range(9):
        ev.append((1.6 + k * 0.25, "pop"))          # brains popping in
    for k in range(8):
        ev.append((9.2 + k * 0.45, "ding"))         # nerve centers lighting
    ev += [(5.4, "pop"), (15.3, "tick"), (17.6, "ding"), (19.0, "whoosh"), (20.6, "pop")]
    ev += [(24.8, "pop"), (26.4, "pop"), (28.0, "pop"), (29.6, "pop"), (30.8, "pop")]
    ev += [(36.0 + k * 0.5, "tick") for k in range(9)]
    ev += [(40.6, "boom"), (40.6, "pop"), (49.2, "boom"), (49.5, "pop"), (56.5, "pop"), (56.7, "ding")]
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
        for k, fr in enumerate(pool.imap(render_frame, range(n), chunksize=8)):
            ff.stdin.write(fr)
    ff.stdin.close()
    ff.wait()


if __name__ == "__main__":
    main()
