"""«Дискотека 1986» — the looping scene, drawn in code.

A soviet flat at night: a rug on the wall, a lacquered table, two neon tubes
(pink left, blue right) and a cassette whose reels turn.  Everything is built
in "albedo" space and lit by a light field, then passed through a VHS look.

The loop is seamless: reels turn a whole number of times, flicker / tracking
band / noise all have periods that divide the loop length.
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "..", "honey-80s", "fonts")
F_TITLE = os.path.join(FONTS, "RussoOne-Regular.ttf")
F_NARROW = os.path.join(FONTS, "PTSansNarrow-Bold.ttf")

FPS = 30
LOOP_S = 8
NFRAMES = FPS * LOOP_S
SS = 2  # supersampling for static drawing

PINK = np.array([1.00, 0.18, 0.62], np.float32)
BLUE = np.array([0.18, 0.48, 1.00], np.float32)


def font(path, size):
    return ImageFont.truetype(path, int(size))


def blur(arr, r):
    """Gaussian blur of a float HxWxC (or HxW) array in [0, ~]."""
    squeeze = arr.ndim == 2
    a = arr[..., None] if squeeze else arr
    out = np.empty_like(a)
    for c in range(a.shape[2]):
        m = float(a[..., c].max()) or 1.0
        im = Image.fromarray(np.clip(a[..., c] / m * 255, 0, 255).astype(np.uint8))
        out[..., c] = np.asarray(im.filter(ImageFilter.GaussianBlur(r)), np.float32) / 255 * m
    return out[..., 0] if squeeze else out


def to_f(im):
    return np.asarray(im, np.float32) / 255.0


# --------------------------------------------------------------------------- background

def wall_and_table(W, H, table_y, rug):
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    img = np.zeros((H, W, 3), np.float32)

    # wallpaper: muted beige stripes with a small diamond motif
    sx = (x % 64) / 64.0
    sy = (y % 64) / 64.0
    stripe = (np.abs(sx - 0.5) < 0.06).astype(np.float32)
    diamond = ((np.abs(sx - 0.5) + np.abs(sy - 0.5)) < 0.16).astype(np.float32)
    base = np.array([0.52, 0.45, 0.36], np.float32)
    img[:] = base
    img *= (1 - 0.18 * stripe)[..., None]
    img = img * (1 - diamond[..., None]) + diamond[..., None] * np.array([0.60, 0.50, 0.36])

    # the rug (ковёр) — border bands + concentric diamond medallion
    rx0, ry0, rx1, ry1 = rug
    inside = (x >= rx0) & (x < rx1) & (y >= ry0) & (y < ry1)
    u = (x - rx0) / (rx1 - rx0)
    v = (y - ry0) / (ry1 - ry0)
    asp = (rx1 - rx0) / (ry1 - ry0)
    edge = np.minimum(np.minimum(u, 1 - u) * asp, np.minimum(v, 1 - v))
    pal = np.array([
        [0.48, 0.07, 0.09],   # burgundy
        [0.62, 0.14, 0.10],   # red
        [0.12, 0.13, 0.30],   # navy
        [0.80, 0.68, 0.48],   # cream
        [0.30, 0.05, 0.07],   # dark red
    ], np.float32)
    d = np.abs(u - 0.5) * asp + np.abs(v - 0.5)
    band = np.floor(d * 14).astype(int)
    # small repeating motif in the field
    mu = ((u * asp * 9) % 1.0) - 0.5
    mv = ((v * 9) % 1.0) - 0.5
    motif = (np.abs(mu) + np.abs(mv)) < 0.22
    idx = np.where(motif & (band % 2 == 0), 3, band % 3)
    idx = np.where(d < 0.32, np.where(band % 2 == 0, 4, 1), idx)
    idx = np.where(d < 0.12, 3, idx)
    # border
    bk = np.floor(edge * 60).astype(int)
    border = edge < 0.10
    bidx = np.where(bk % 3 == 0, 2, np.where(bk % 3 == 1, 3, 0))
    zig = (((u * asp * 30 + v * 0) % 1.0) - 0.5)
    bidx = np.where((bk == 3) & (np.abs(zig) < 0.25), 1, bidx)
    idx = np.where(border, bidx, idx)
    rugcol = pal[np.clip(idx, 0, 4)]
    # wool texture
    rng = np.random.default_rng(7)
    tex = 1 + 0.08 * (rng.random((H, W)).astype(np.float32) - 0.5)
    rugcol = rugcol * tex[..., None]
    img = np.where(inside[..., None], rugcol, img)
    # soft shadow around rug
    shadow = blur((~inside).astype(np.float32) * 0 + inside.astype(np.float32), 12)
    img *= (1 - 0.25 * np.clip(shadow - inside, 0, 1))[..., None]

    # table: lacquered wood
    t = (y - table_y) / (H - table_y + 1)
    grain_p = (y * 0.16 + 5 * np.sin(y * 0.019 + x * 0.0011) + 1.6 * np.sin(x * 0.0021 + y * 0.003) + 0.7 * np.sin(x * 0.0097 + 1.3))
    grain = 0.5 + 0.5 * np.sin(grain_p)
    fine = 0.5 + 0.5 * np.sin(grain_p * 7.3)
    wood_a = np.array([0.42, 0.22, 0.11], np.float32)
    wood_b = np.array([0.28, 0.13, 0.06], np.float32)
    wood = wood_a * (1 - grain[..., None]) + wood_b * grain[..., None]
    wood *= (0.92 + 0.08 * fine)[..., None]
    wood *= (1.0 - 0.25 * t)[..., None]
    table = y >= table_y
    img = np.where(table[..., None], wood, img)
    # table edge highlight line
    edge_band = np.exp(-((y - table_y) / 3.0) ** 2)
    img += edge_band[..., None] * 0.12
    # wall shadow just above table
    above = np.clip((table_y - y) / 40.0, 0, 1)
    img *= np.where(y < table_y, 0.75 + 0.25 * above, 1.0)[..., None]
    return img


def light_masks(W, H, table_y):
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    def radial(cx, cy, r):
        d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r
        return 1 / (1 + d * d * 2.2)
    pink = radial(-0.04 * W, 0.35 * H, 0.75 * max(W, H))
    blue = radial(1.04 * W, 0.35 * H, 0.75 * max(W, H))
    # glossy table: a reflected streak of each tube
    tab = (y >= table_y).astype(np.float32)
    refl_p = np.exp(-((x - 0.05 * W) / (0.06 * W)) ** 2) * tab * np.exp(-(y - table_y) / (0.25 * H))
    refl_b = np.exp(-((x - 0.95 * W) / (0.06 * W)) ** 2) * tab * np.exp(-(y - table_y) / (0.25 * H))
    return pink, blue, refl_p, refl_b


def tube_glow(W, H, table_y):
    """Additive emission of the two neon tubes (pink, blue) as HxW masks."""
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    def tube(cx):
        core = (np.abs(x - cx) < 0.006 * W) & (y > 0.06 * H) & (y < table_y - 0.03 * H)
        core = core.astype(np.float32)
        return core * 1.4 + blur(core, 0.012 * W) * 3.0 + blur(core, 0.05 * W) * 2.5
    return tube(0.04 * W), tube(0.96 * W)


# --------------------------------------------------------------------------- cassette

def cassette_layers(cw):
    """Return (over RGBA, window mask, hub sprite, packs) drawn at SS and downsampled.

    over: body + label with the window cut out (glass tint inside)
    """
    ch = int(cw * 0.64)
    S = SS
    W, H = cw * S, ch * S
    over = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    # body
    d.rounded_rectangle([0, 0, W - 1, H - 1], radius=int(0.035 * W), fill=(30, 30, 36, 255))
    d.rounded_rectangle([6 * S, 6 * S, W - 6 * S, H - 6 * S], radius=int(0.03 * W),
                        outline=(52, 52, 60, 255), width=2 * S)
    # label
    lx0, ly0, lx1, ly1 = 0.06 * W, 0.07 * H, 0.94 * W, 0.66 * H
    d.rounded_rectangle([lx0, ly0, lx1, ly1], radius=int(0.012 * W), fill=(238, 228, 204, 255))
    # 80s stripes
    stripes = [(232, 62, 140), (246, 128, 60), (250, 196, 64), (64, 150, 230)]
    sy = 0.215 * H
    sh = 0.028 * H
    for i, c in enumerate(stripes):
        d.rectangle([lx0, sy + i * sh, lx1, sy + (i + 1) * sh - S], fill=c + (255,))
    # side letter box
    d.rectangle([lx0 + 0.02 * W, 0.09 * H, lx0 + 0.075 * W, 0.20 * H], fill=(30, 30, 36, 255))
    fA = font(F_TITLE, 0.075 * H)
    d.text((lx0 + 0.0475 * W, 0.145 * H), "А", font=fA, fill=(238, 228, 204, 255), anchor="mm")
    # title
    ft = font(F_TITLE, 0.105 * H)
    d.text((0.53 * W, 0.142 * H), "ДИСКОТЕКА 1986", font=ft, fill=(36, 28, 70, 255), anchor="mm")
    # lower label line: handwritten-ish note
    fn = font(F_NARROW, 0.06 * H)
    d.text((lx0 + 0.03 * W, 0.62 * H), "сторона А · микс", font=fn, fill=(70, 50, 120, 255), anchor="ls")
    d.text((lx1 - 0.03 * W, 0.62 * H), "C-90", font=fn, fill=(200, 40, 110, 255), anchor="rs")

    # window (cut out)
    wx0, wy0, wx1, wy1 = 0.17 * W, 0.355 * H, 0.83 * W, 0.575 * H
    win = Image.new("L", (W, H), 0)
    ImageDraw.Draw(win).rounded_rectangle([wx0, wy0, wx1, wy1], radius=int(0.11 * H), fill=255)
    a = np.asarray(over, np.uint8).copy()
    wm = np.asarray(win, np.uint8) > 127
    # glass tint: dark and slightly transparent
    a[wm] = (20, 20, 26, 70)
    over = Image.fromarray(a, "RGBA")
    d = ImageDraw.Draw(over)
    # glass reflection streaks
    refl = Image.new("L", (W, H), 0)
    rd = ImageDraw.Draw(refl)
    for off, wdt in ((0.30, 0.05), (0.40, 0.018)):
        x0 = off * W
        rd.polygon([(x0, wy0), (x0 + wdt * W, wy0), (x0 + wdt * W - 0.08 * W, wy1), (x0 - 0.08 * W, wy1)], fill=60)
    refl = np.asarray(refl, np.float32) * wm
    a = np.asarray(over, np.float32)
    k = refl[..., None] / 255.0
    a[..., :3] = a[..., :3] * (1 - k) + 255 * k
    a[..., 3] = np.maximum(a[..., 3], refl)
    over = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")
    d = ImageDraw.Draw(over)
    d.rounded_rectangle([wx0, wy0, wx1, wy1], radius=int(0.11 * H), outline=(18, 18, 22, 255), width=3 * S)

    # bottom trapezoid with holes
    ty0 = 0.74 * H
    d.polygon([(0.22 * W, ty0), (0.78 * W, ty0), (0.83 * W, H - 1), (0.17 * W, H - 1)], fill=(44, 44, 52, 255))
    for cx in (0.30, 0.70):
        d.ellipse([cx * W - 0.022 * W, 0.86 * H - 0.022 * W, cx * W + 0.022 * W, 0.86 * H + 0.022 * W], fill=(8, 8, 10, 255))
    for cx in (0.42, 0.58):
        d.rectangle([cx * W - 0.016 * W, 0.83 * H, cx * W + 0.016 * W, 0.90 * H], fill=(8, 8, 10, 255))
    # screws
    for sx_, sy_ in ((0.035, 0.05), (0.965, 0.05), (0.035, 0.94), (0.965, 0.94), (0.5, 0.70)):
        r = 0.011 * W
        d.ellipse([sx_ * W - r, sy_ * H - r, sx_ * W + r, sy_ * H + r], fill=(70, 70, 80, 255))
        d.line([sx_ * W - r * 0.7, sy_ * H, sx_ * W + r * 0.7, sy_ * H], fill=(30, 30, 36, 255), width=S * 2)

    over = over.resize((cw, ch), Image.LANCZOS)
    win_small = win.resize((cw, ch), Image.LANCZOS)

    # hub sprite (white sprocket with 6 teeth), radius 0.052*cw
    hr = int(0.056 * cw * S)
    hs = Image.new("RGBA", (2 * hr, 2 * hr), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hs)
    hd.ellipse([0, 0, 2 * hr - 1, 2 * hr - 1], fill=(235, 232, 225, 255))
    ri = int(hr * 0.66)
    hd.ellipse([hr - ri, hr - ri, hr + ri, hr + ri], fill=(0, 0, 0, 0))
    for k in range(6):
        ang = k * math.pi / 3
        ca, sa = math.cos(ang), math.sin(ang)
        w2 = hr * 0.13
        r0, r1 = ri * 0.62, ri + 2
        pts = [(hr + ca * r0 - sa * w2, hr + sa * r0 + ca * w2), (hr + ca * r1 - sa * w2, hr + sa * r1 + ca * w2),
               (hr + ca * r1 + sa * w2, hr + sa * r1 - ca * w2), (hr + ca * r0 + sa * w2, hr + sa * r0 - ca * w2)]
        hd.polygon(pts, fill=(235, 232, 225, 255))
    # a mark so the turning reads even through symmetry
    hd.ellipse([hr - hr * 0.12, hr * 0.06, hr + hr * 0.12, hr * 0.30], fill=(220, 60, 130, 255))

    def pack(radius_frac):
        R = int(radius_frac * cw * S)
        im = Image.new("RGBA", (2 * R, 2 * R), (0, 0, 0, 0))
        pd = ImageDraw.Draw(im)
        pd.ellipse([0, 0, 2 * R - 1, 2 * R - 1], fill=(58, 34, 22, 255))
        rng = np.random.default_rng(R)
        for rr in np.linspace(hr * 1.02, R - 2, 26):
            c = int(rng.integers(46, 78))
            pd.ellipse([R - rr, R - rr, R + rr, R + rr], outline=(c, int(c * 0.6), int(c * 0.38), 255), width=S)
        # clear flange spokes (rotate with the reel)
        for k in range(3):
            ang = k * 2 * math.pi / 3
            pd.line([R, R, R + math.cos(ang) * R * 0.98, R + math.sin(ang) * R * 0.98],
                    fill=(150, 150, 160, 90), width=int(0.012 * cw * S))
        # specks so motion is visible
        for _ in range(40):
            rr = rng.uniform(hr * 1.1, R * 0.97)
            an = rng.uniform(0, 2 * math.pi)
            px, py = R + rr * math.cos(an), R + rr * math.sin(an)
            pd.ellipse([px - S * 2, py - S * 2, px + S * 2, py + S * 2], fill=(110, 76, 50, 255))
        return im

    packs = (pack(0.175), pack(0.105))
    return over, win_small, hs, packs, ch


def rotate_sprite(sprite_ss, angle_deg, size):
    r = sprite_ss.rotate(angle_deg, resample=Image.BICUBIC)
    return r.resize((size, size), Image.LANCZOS)


# --------------------------------------------------------------------------- scene

class Scene:
    def __init__(self, W, H, vertical=False):
        self.W, self.H = W, H
        if vertical:
            self.table_y = int(0.60 * H)
            rug = (int(0.06 * W), int(0.12 * H), int(0.94 * W), int(0.63 * H))
            cw = int(0.86 * W)
            ccx, cbottom = W // 2, int(0.745 * H)
        else:
            self.table_y = int(0.64 * H)
            rug = (int(0.13 * W), int(0.0 * H), int(0.87 * W), int(0.68 * H))
            cw = int(0.46 * W)
            ccx, cbottom = W // 2, int(0.90 * H)
        bg = wall_and_table(W, H, self.table_y, rug)
        self.pink, self.blue, self.rp, self.rb = light_masks(W, H, self.table_y)
        self.gp, self.gb = tube_glow(W, H, self.table_y)

        over, win, hub, packs, ch = cassette_layers(cw)
        self.cw, self.ch = cw, ch
        self.cx0 = ccx - cw // 2
        self.cy0 = cbottom - ch
        # shadow on table under cassette
        sh = np.zeros((H, W), np.float32)
        y0 = cbottom - int(0.02 * H)
        sh[y0:cbottom + int(0.02 * H), self.cx0 + 10:self.cx0 + cw - 10] = 1
        sh = blur(sh, 0.015 * W)
        bg *= (1 - 0.6 * sh)[..., None]
        self.bg = bg
        self.over = to_f(over)
        self.hub = hub
        self.packs = packs
        self.reels = [(int(0.30 * cw), int(0.466 * ch)), (int(0.70 * cw), int(0.466 * ch))]
        self.hub_px = int(0.112 * cw)
        self.pack_px = [packs[0].size[0] // SS, packs[1].size[0] // SS]
        rng = np.random.default_rng(3)
        self.noise = [np.repeat(rng.normal(0, 1, (H, W // 4 + 1)).astype(np.float32), 4, axis=1)[:, :W] for _ in range(8)]
        self.osd_font = font(F_NARROW, 0.045 * H if not vertical else 0.026 * H)
        self.vertical = vertical

    def _paste(self, img, sprite, cx, cy):
        s = to_f(sprite)
        h, w = s.shape[:2]
        x0, y0 = cx - w // 2, cy - h // 2
        a = s[..., 3:4]
        img[y0:y0 + h, x0:x0 + w] = img[y0:y0 + h, x0:x0 + w] * (1 - a) + s[..., :3] * a

    def albedo(self, f):
        img = self.bg.copy()
        t = f / NFRAMES
        cas = img[self.cy0:self.cy0 + self.ch, self.cx0:self.cx0 + self.cw]
        # dark cavity behind window
        cas[:] = cas * 0.15 + 0.03
        # reels: 2 turns of the hub per loop (takeup on the right turns faster)
        turns = (2, 3)
        for i, (rx, ry) in enumerate(self.reels):
            ang = -360.0 * turns[i] * t
            self._paste(cas, rotate_sprite(self.packs[i], ang, self.pack_px[i]), rx, ry)
            self._paste(cas, rotate_sprite(self.hub, ang, self.hub_px), rx, ry)
        # tape strand between packs along the bottom of the window
        yb = int(0.575 * self.ch) - 3
        cas[yb:yb + 3, int(0.2 * self.cw):int(0.8 * self.cw)] = (0.22, 0.13, 0.08)
        a = self.over[..., 3:4]
        cas[:] = cas * (1 - a) + self.over[..., :3] * a
        return img

    def frame(self, f):
        t = f / NFRAMES
        img = self.albedo(f)
        # neon flicker (periods divide the loop): pink stutters twice per loop
        fp = 1.0
        ph = (t * 2) % 1.0
        if 0.62 < ph < 0.64 or 0.67 < ph < 0.68:
            fp = 0.45
        fb = 0.92 + 0.08 * math.sin(2 * math.pi * t * 4)
        L = (0.16
             + self.pink[..., None] * PINK * 1.25 * fp
             + self.blue[..., None] * BLUE * 1.25 * fb)
        out = img * L
        out += (self.rp[..., None] * PINK * fp + self.rb[..., None] * BLUE * fb) * 0.35
        out += self.gp[..., None] * PINK * fp * 0.9 + self.gb[..., None] * BLUE * fb * 0.9
        return vhs(out, f, self)


# --------------------------------------------------------------------------- VHS

def vhs(img, f, sc):
    H, W = img.shape[:2]
    t = f / NFRAMES
    img = np.clip(img, 0, 1.5)
    # softness: VHS has ~ 330 lines of luma, much less chroma
    Y = img @ np.array([0.299, 0.587, 0.114], np.float32)
    C = img - Y[..., None]
    Yi = Image.fromarray(np.clip(Y * 170, 0, 255).astype(np.uint8))
    Y = np.asarray(Yi.resize((W * 2 // 3, H), Image.BILINEAR).resize((W, H), Image.BICUBIC), np.float32) / 170
    Cs = np.empty_like(C)
    for c in range(3):
        ci = Image.fromarray(np.clip((C[..., c] + 1) * 127, 0, 255).astype(np.uint8))
        Cs[..., c] = np.asarray(ci.resize((W // 6, H // 2), Image.BILINEAR).resize((W, H), Image.BICUBIC), np.float32) / 127 - 1
    Cs = np.roll(Cs, 5 if W > H else 4, axis=1)  # chroma delay
    img = Y[..., None] + Cs * 1.15

    # per-row wobble + tracking band rolling down once per loop
    ys = np.arange(H, dtype=np.float32)
    shift = 1.4 * np.sin(2 * np.pi * (ys / H * 3 + t * 2))
    band_c = (t * (H + 300)) - 150
    band = np.exp(-((ys - band_c) / 22.0) ** 2)
    rng = np.random.default_rng(f)
    shift += band * rng.normal(0, 9, H)
    xi = np.clip((np.arange(W)[None, :] - shift[:, None]).astype(np.int32), 0, W - 1)
    img = img[np.arange(H)[:, None], xi]
    img *= (1 + 0.25 * band)[:, None, None]

    # noise, stronger in the band
    n = sc.noise[f % 8]
    img += ((0.016 + 0.12 * band[:, None]) * n)[..., None]
    # scanlines
    img[1::2] *= 0.88
    # vignette
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = ((xx / W - 0.5) ** 2 + (yy / H - 0.5) ** 2)
    img *= (1 - 0.55 * v)[..., None]

    out = Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8))
    # OSD
    d = ImageDraw.Draw(out)
    m = int(0.04 * min(W, H))
    def play(x, y):
        d.text((x, y), "PLAY", font=sc.osd_font, fill=(235, 235, 235))
        x1 = x + d.textlength("PLAY ", font=sc.osd_font)
        b = d.textbbox((x, y), "PLAY", font=sc.osd_font)
        h = b[3] - b[1]
        d.polygon([(x1, b[1]), (x1, b[3]), (x1 + h * 0.8, b[1] + h / 2)], fill=(235, 235, 235))
    if sc.vertical:
        top = int(0.06 * H)
        play(m, top)
        d.text((W - m, top), "SP", font=sc.osd_font, fill=(235, 235, 235), anchor="ra")
    else:
        play(m, m)
        d.text((m, H - m), "SP", font=sc.osd_font, fill=(235, 235, 235), anchor="ld")
        d.text((W - m, H - m), "1986", font=sc.osd_font, fill=(235, 235, 235), anchor="rd")
    return out
