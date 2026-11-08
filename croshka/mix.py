"""Score (comic nature-doc orchestra, synthesized) + foley + optional narration (voice.wav) → out/mix.wav.
Everything is generated in numpy for this film; no samples."""
import json, os
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.ndimage import maximum_filter1d
HERE = os.path.dirname(os.path.abspath(__file__)); SR = 48000
E = json.load(open(os.path.join(HERE, 'events.json'))); DUR = E['dur']; EV = E['ev']
N = int((DUR + 3) * SR); rng = np.random.default_rng(7)
def tt(d): return np.arange(int(max(d, 0) * SR)) / SR
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b): return sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), x)
def noise(d): return rng.standard_normal(int(max(d, 0) * SR))
def env(d, a, r): x = tt(d); return np.minimum(1, x / max(a, 1e-3)) * np.minimum(1, np.maximum(0, d - x) / max(r, 1e-3))
def add(buf, at, sig, g=1.0):
    if np.isscalar(sig): return
    i = int(at * SR)
    if i < 0: sig = sig[-i:]; i = 0
    j = min(len(buf), i + len(sig))
    if j > i: buf[i:j] += sig[:j - i] * g
def osc(f, x, kind='saw', n=12):
    if kind == 'sine': return np.sin(2 * np.pi * f * x)
    s = 0
    for k in range(1, n + 1):
        if f * k > 9000: break
        if kind == 'square' and k % 2 == 0: continue
        s = s + np.sin(2 * np.pi * f * k * x) / k
    return s
# ——— instruments
def pizz(m, v=1.0, d=1.2):
    x = tt(d); f = hz(m); s = sum(a * np.sin(2 * np.pi * f * k * x) * np.exp(-x * (5 + k * 3)) for k, a in ((1, 1), (2, .5), (3, .25), (4, .12)))
    return lp(s * np.minimum(1, x / .004), 3500) * .16 * v
def bassoon(m, d, v=1.0, stac=False):
    d2 = d * (.55 if stac else .95); x = tt(d2); f = hz(m) * (1 + .004 * np.sin(2 * np.pi * 5 * x) * np.minimum(1, x / .3))
    ph = 2 * np.pi * np.cumsum(f) / SR; s = sum(np.sin(ph * k) * a for k, a in ((1, .6), (2, 1), (3, .7), (4, .45), (5, .3), (6, .15)))
    return lp(s, 1500) * env(d2, .03, .06) * .07 * v
def brass(m, d, v=1.0):
    x = tt(d); f = hz(m) * (1 + .003 * np.sin(2 * np.pi * 5.5 * x)); ph = 2 * np.pi * np.cumsum(f) / SR
    br = 900 + 2400 * np.minimum(1, x / .08) * np.exp(-x * 1.5)
    s = sum(np.sin(ph * k) / k ** .8 for k in range(1, 10)); s = lp(s, 3000) * .6 + lp(s, 1100) * .4
    return s * env(d, .04, .08) * .06 * v * (br / 3300 + .3)
def tuba(m, d, v=1.0):
    x = tt(d * .7); ph = 2 * np.pi * hz(m) * x; s = sum(np.sin(ph * k) / k for k in range(1, 6))
    return lp(s, 600) * env(d * .7, .02, .08) * .16 * v
def glock(m, v=1.0):
    x = tt(1.6); f = hz(m); s = np.sin(2 * np.pi * f * x) * np.exp(-x * 3) + .3 * np.sin(2 * np.pi * f * 2.76 * x) * np.exp(-x * 8)
    return s * np.minimum(1, x / .002) * .06 * v
def reed(m, d, v=1.0):   # accordion-ish
    x = tt(d); s = sum(osc(hz(m) * (1 + det), x, 'square', 8) for det in (-.004, 0, .004))
    return lp(s, 2200) * env(d, .05, .1) * .03 * v
def pad(ms, d, v=1.0, bright=1400):
    x = tt(d); e = env(d, min(1.2, d / 3), min(1.2, d / 3))
    s = sum(np.sin(2 * np.pi * hz(m) * x * (1 + det)) for m in ms for det in (-.003, 0, .003))
    return lp(s, bright) * e * .025 * v
def choir(ms, d, v=1.0):
    x = tt(d); e = env(d, 2, 1.5); s = 0
    for m in ms:
        for det in (-.005, 0, .005):
            ph = 2 * np.pi * hz(m) * (1 + det) * x + .6 * np.sin(2 * np.pi * 5 * x)
            s = s + sum(np.sin(ph * k) * a for k, a in ((1, 1), (2, .5), (3, .3), (4, .1)))
    return (bp(s, 300, 1100) * .7 + lp(s, 400) * .3) * e * .02 * v
def timp(m, v=1.0):
    x = tt(1.6); f = hz(m); s = np.sin(2 * np.pi * f * x) * np.exp(-x * 3) + .4 * np.sin(2 * np.pi * f * 1.5 * x) * np.exp(-x * 5) + lp(noise(1.6), 300) * np.exp(-x * 20) * .5
    return s * .3 * v
def snare(v=1.0): x = tt(.25); return (bp(noise(.25), 1500, 7000) * np.exp(-x * 22) + np.sin(2 * np.pi * 190 * x) * np.exp(-x * 30) * .5) * .12 * v
def wood(v=1.0, f=900): x = tt(.12); return (np.sin(2 * np.pi * f * x) * np.exp(-x * 60) + bp(noise(.12), f, f * 3) * np.exp(-x * 80) * .3) * .14 * v
def kick(v=1.0): x = tt(.4); return np.sin(2 * np.pi * (50 + 80 * np.exp(-x * 25)) * x) * np.exp(-x * 9) * .4 * v
def whistle(m, d, v=1.0, glide=0):
    x = tt(d); f = hz(m) * (1 + .012 * np.sin(2 * np.pi * 6 * x) * np.minimum(1, x / .25)) * (1 + glide * np.minimum(1, x / .15) - glide)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) + bp(noise(d), 1500, 3500) * .04) * env(d, .06, .12) * .07 * v
# ——— score
mus = np.zeros(N)
def seq(t0, bpm, notes, inst, *a, **k):
    b = 60 / bpm
    for beat, m, dur in notes:
        if m is None: continue
        at = t0 + beat * b
        if any(f0 <= at < f1 for f0, f1 in RESTS): continue
        sig = inst(m, *a, **k) if inst in (pizz, glock, timp) else inst(m, dur * b, *a, **k)
        add(mus, at, sig)
FREEZE = [e['t'] for e in EV if e['type'] == 'freeze']
RESTS = [(f, f + 1.4) for f in FREEZE] + [(14.6, 17.0), (56.4, 57.6)]
def P(s):   # "beat:midi:dur beat:midi:dur ..."
    return [tuple(float(v) if i != 1 else (None if v == '-' else int(v)) for i, v in enumerate(n.split(':'))) for n in s.split()]
cues = {e['mood']: (e['t'], e['d']) for e in EV if e['type'] == 'mus'}
# morning: pizz + glock, C major, 96 bpm
t0, d = cues['morning']; bpm = 96; b = 60 / bpm
bars = int(d / (4 * b)) + 1
for k in range(bars):
    root = [48, 53, 55, 48][k % 4]
    seq(t0 + k * 4 * b, bpm, [(0, root, 1), (1, root + 7, 1), (2, root + 12, 1), (3, root + 7, 1)], pizz, .8)
seq(t0 + 4 * b, bpm, P('0:76:1 1:79:1 2:81:.5 2.5:79:.5 3:76:1 4:74:1 5:72:1 6:74:2 8:76:1 9:79:1 10:84:1 11:83:.5 11.5:81:.5 12:79:2 14:76:2 16:72:1 17:74:1 18:76:1 19:79:1 20:77:2'), glock, .9)
add(mus, 14.4, pad([48, 55, 60, 63], 3.2, 1.2, 900))
# hero: brass fanfare + timpani, 100 bpm
t0, d = cues['hero']; bpm = 100; b = 60 / bpm
seq(t0 + .3, bpm, P('0:60:.5 .5:60:.5 1:67:1.5 2.5:64:.5 3:72:2 5:71:.5 5.5:72:.5 6:74:1 7:76:2 9:74:1 10:72:1 11:67:2 13:72:.5 13.5:76:.5 14:79:3'), brass, 1)
seq(t0 + .3, bpm, P('0:48:1 3:43:1 5:48:1 7:43:1 9:41:1 11:43:1 13:48:1 14:36:2'), timp, .9)
for k in range(int(d / b)): add(mus, t0 + .3 + k * b, snare(.35 if k % 2 else .2))
[add(mus, t0 + .3 + bt * b, pad([r, r + 7, r + 12, r + 16], dd * b, .9)) for bt, r, dd in ((0, 48, 4), (4, 53, 4), (8, 55, 4), (12, 48, 6))]
# pigeon: comic bassoon + tuba oom-pah, F major, 112 bpm
t0, d = cues['pigeon']; bpm = 112; b = 60 / bpm
for k in range(int(d / (2 * b))):
    r = [41, 46, 48, 41][(k // 2) % 4]; seq(t0 + k * 2 * b, bpm, [(0, r, .5)], tuba, .9); add(mus, t0 + k * 2 * b + b, pizz(r + 16, .6) + pizz(r + 19, .5))
mel = '0:65:.5 .5:67:.5 1:69:1 2:65:.5 2.5:-:.5 3:72:1 4:70:.5 4.5:69:.5 5:67:1 6:65:2 8:69:.5 8.5:70:.5 9:72:1 10:74:.5 10.5:72:.5 11:69:1 12:67:.5 12.5:65:.5 13:64:.5 13.5:62:.5 14:60:2'
for rep in range(2): seq(t0 + 1 + rep * 16 * b, bpm, P(mel), bassoon, 1.1, True)
seq(t0 + 1 + 32 * b, bpm, P('0:60:1 1:65:1 2:69:1 3:72:3'), bassoon, 1.0)
# hero2: march → deflate → sad
t0, d = cues['hero2']; bpm = 120; b = 60 / bpm
march_end = 56.4
for k in range(int((march_end - t0) / b)):
    add(mus, t0 + k * b, snare(.5 if k % 2 else .3)); add(mus, t0 + k * b, kick(.6) if k % 2 == 0 else 0)
seq(t0, bpm, P('0:67:.5 .5:67:.5 1:72:1 2:74:.5 2.5:76:.5 3:77:1 4:79:2 6:76:.5 6.5:77:.5 7:79:1 8:84:1 9:79:1 10:76:1'), brass, 1.1)
x = tt(1.4); add(mus, march_end + .05, np.sin(2 * np.pi * np.cumsum(np.geomspace(330, 70, len(x))) / SR) * np.sin(np.pi * x / 1.4) * .12)  # trombone deflate
seq(58.0, 70, P('0:69:1 1:67:1 2:64:1 3:62:2 6:69:1 7:67:1 8:65:1 9:64:3'), bassoon, .8)
seq(58.0, 70, P('0:45:2 2:41:2 4:43:2 6:45:2 8:41:2 10:40:2'), pizz, .7)
# sneak: pizz tiptoe in A minor, woodblock, 132 bpm
t0, d = cues['sneak']; bpm = 132; b = 60 / bpm
pat = [45, 52, 48, 52, 47, 52, 48, 52]
for k in range(int(d / b)):
    at = t0 + k * b
    if any(f0 <= at < f1 for f0, f1 in RESTS): continue
    add(mus, at, pizz(pat[k % 8] + (0 if (k // 16) % 2 == 0 else -2), .8, .5))
    if k % 2: add(mus, at, wood(.5, 1200 if k % 4 == 1 else 900))
mel = '0:69:.5 1:72:.5 2:71:.5 3:69:.5 4:68:.5 5:69:1 8:76:.5 9:74:.5 10:72:.5 11:71:.5 12:69:2'
for rep in range(3): seq(t0 + 4 * b + rep * 16 * b * 1.5, bpm, P(mel), bassoon, .8, True)
for f in FREEZE: add(mus, f + 1.4, pizz(57, .8) + pizz(64, .6))
# chase: SLOW heavy galop — tuba oom-pah, brass stabs, cymbal, 88 bpm (the slowest chase)
t0, d = cues['chase']; bpm = 88; b = 60 / bpm
for k in range(int(d / b) + 1):
    at = t0 + 1.4 + k * b; r = [45, 40, 45, 40, 41, 43, 45, 40][(k // 2) % 8]
    if at > t0 + d: break
    if 118.2 < at < 121: continue
    add(mus, at, tuba(r, b, 1.1)); add(mus, at + b / 2, pizz(r + 12, .7) + pizz(r + 16, .6) + pizz(r + 19, .5)); add(mus, at, kick(.5)); add(mus, at + b / 2, snare(.4))
mel = '0:69:.5 .5:69:.5 1:72:.5 1.5:69:.5 2:76:1 3:74:.5 3.5:72:.5 4:71:.5 4.5:72:.5 5:74:1 6:76:2 8:69:.5 8.5:69:.5 9:72:.5 9.5:69:.5 10:77:1 11:76:.5 11.5:74:.5 12:72:.5 12.5:71:.5 13:69:1 14:68:1 15:69:1'
seq(t0 + 1.4, bpm, P(mel), brass, .9); seq(t0 + 1.4 + 16 * b + 1.2, bpm, P(mel), brass, .9)
seq(121.0, bpm, P(mel), bassoon, 1.2, True)
# western: whistle + plucked strums
t0, d = cues['western']; bpm = 76; b = 60 / bpm
seq(t0 + .4, bpm, P('0:69:1.5 1.5:74:.5 2:69:1 3:-:1 4:67:1.5 5.5:62:.5 6:64:2'), whistle, 1.0)
for k in range(5): at = t0 + .4 + k * 2 * b; [add(mus, at + i * .025, pizz(m, .5, 1.5)) for i, m in enumerate((45, 52, 57, 60, 64))]
add(mus, t0 + 4, pad([45, 52, 57], d - 4, .8, 700))
# slowmo: choir swell + low timpani rolls
t0, d = cues['slowmo']
add(mus, t0, choir([57, 64, 69, 72], 8, 1.0)); add(mus, t0 + 7, choir([53, 60, 65, 69], 6, 1.1)); add(mus, t0 + 12, choir([55, 62, 67, 71, 74], 5.8, 1.3))
for k in range(int(d / .9)): add(mus, t0 + k * .9, timp(33, .25 + .3 * k / (d / .9)))
add(mus, t0, pad([33, 45], d, 1.2, 300))
# stuck: silence, then lonely bassoon "bwomp"s
t0, d = cues['stuck']
seq(167.0, 60, P('0:41:1 2:40:1 4:39:2'), bassoon, .9); seq(179.5, 60, P('0:41:1 1.5:43:.5 2:36:2'), bassoon, .8)
seq(184.0, 72, P('0:48:1 1:-:1 2:43:1 3:-:1 4:48:1 6:43:2'), pizz, .6)
# granny: gentle waltz, accordion-ish reed + pizz + glock, 3/4 at 132 bpm
t0, d = cues['granny']; bpm = 132; b = 60 / bpm
prog = [48, 43, 45, 41, 48, 43, 41, 48]
for k in range(int(d / (3 * b))):
    r = prog[k % 8]; at = t0 + k * 3 * b; add(mus, at, pizz(r, .9)); add(mus, at + b, pizz(r + 16, .5) + pizz(r + 19, .45)); add(mus, at + 2 * b, pizz(r + 16, .5) + pizz(r + 19, .45))
mel = '0:76:2 2:79:1 3:77:3 6:74:2 8:76:1 9:72:3 12:72:2 14:74:1 15:76:2 17:77:1 18:79:3 21:76:3'
for rep in range(3): seq(t0 + 1.4 + rep * 24 * b, bpm, P(mel), reed, 1.0)
seq(t0 + 1.4 + 12 * b, bpm, P('0:84:1 3:88:1 6:86:1 9:84:1'), glock, .7)
# outro: sly walking bass + glock
t0, d = cues['outro']; bpm = 104; b = 60 / bpm
walk = [45, 48, 50, 51, 52, 50, 48, 47, 45, 43, 41, 40, 45, 48, 50, 52]
for k in range(int(d / b)): add(mus, t0 + k * b, pizz(walk[k % 16] - 12, 1.0, .9)); add(mus, t0 + k * b + b / 2, wood(.25, 2200) if k % 2 else 0)
seq(t0 + 2 * b, bpm, P('0:81:.5 1:84:.5 2:83:1 4:81:.5 5:79:.5 6:76:2 10:81:.5 11:84:.5 12:88:1 13:87:1'), glock, 1.0)
# end: "to be continued" sting
t0, d = cues['end']
add(mus, t0 + .2, brass(60, .25, 1) + brass(64, .25, 1) + brass(67, .25, 1)); add(mus, t0 + .55, brass(61, 2.2, 1) + brass(65, 2.2, 1) + brass(68, 2.2, 1)); add(mus, t0 + .55, timp(37, 1.2))
add(mus, t0 + 2.4, pad([45, 52, 57, 60, 64], 5, 1.2, 1200)); add(mus, 247.4, glock(93, .5) + glock(88, .4))
# ——— foley
fol = np.zeros(N)
def sweep(d, f0, f1, v): x = tt(d); return np.sin(2 * np.pi * np.cumsum(np.geomspace(f0, f1, len(x))) / SR) * np.sin(np.pi * x / d) ** 2 * v
def chirp(d, f0, f1): x = tt(d); return np.sin(2 * np.pi * np.cumsum(np.linspace(f0, f1, len(x))) / SR)
def hum(d, v, muffle=False):
    x = tt(d); s = sum(np.sin(2 * np.pi * 118 * k * x * (1 + .002 * np.sin(2 * np.pi * .7 * x))) / k for k in range(1, 7)) * .3 + bp(noise(d), 600, 4000) * .5 + bp(noise(d), 4000, 9000) * .15
    if muffle: s = lp(s, 500)
    return s * env(d, .4, .4) * .05 * v
def coo(v=1.0, eep=False):
    if eep: x = tt(.25); return chirp(.25, 900, 1600) * np.sin(np.pi * x / .25) * .07 * v
    out = np.zeros(int(1.0 * SR))
    for i, (o, d, f) in enumerate(((0, .22, 330), (.26, .45, 360), (.75, .2, 300))):
        x = tt(d); s = np.sin(2 * np.pi * f * x + 3 * np.sin(2 * np.pi * 28 * x)) * np.sin(np.pi * x / d) ** 1.5
        add(out, o, lp(s + .3 * np.sin(2 * np.pi * f * 2 * x) * np.sin(np.pi * x / d), 1200), .12 * v)
    return out
for e in EV:
    t, ty, d, v = e['t'], e['type'], e.get('d', .5), e.get('v', 1.0)
    if ty == 'steps':
        n = int(d * e.get('rate', 3))
        for i in range(n): x = tt(.12); add(fol, t + i / e.get('rate', 3), lp(noise(.12), 500 + 300 * (i % 2)) * np.exp(-x * 40) * .16)
    elif ty == 'door': x = tt(.9); add(fol, t, bp(noise(.9), 300, 1200) * np.exp(-x * 4) * .05); add(fol, t, chirp(.5, 600, 420) * np.sin(np.pi * tt(.5) / .5) * .02)
    elif ty == 'tick': x = tt(.06); add(fol, t, bp(noise(.06), 2000, 6000) * np.exp(-x * 90) * .25 * v)
    elif ty == 'sting':
        add(mus, t, sum(brass(m, 2.3, 1.3) for m in (48, 51, 54)) * v)
        add(mus, t, timp(36, 1.4 * v))
    elif ty == 'boot':
        for i, m in enumerate((72, 76, 79, 84)): add(fol, t + i * .09, (np.sin(2 * np.pi * hz(m) * tt(.25)) * np.exp(-tt(.25) * 10) * .06))
    elif ty == 'blink': add(fol, t, np.sin(2 * np.pi * 2400 * tt(.04)) * np.exp(-tt(.04) * 80) * .04)
    elif ty == 'fanfare': pass
    elif ty == 'tap':
        for i in range(2): x = tt(.08); add(fol, t + i * .14, (bp(noise(.08), 1500, 5000) * np.exp(-x * 70) + np.sin(2 * np.pi * 1800 * x) * np.exp(-x * 90) * .5) * .22)
    elif ty == 'flap':
        for i in range(int(d / .13)): x = tt(.11); add(fol, t + i * .13, bp(noise(.11), 300, 2500) * np.sin(np.pi * x / .11) * .12)
    elif ty == 'squeak': x = tt(d); add(fol, t, (chirp(d, 1400, 900) + .4 * chirp(d, 2800, 1800)) * env(d, .05, .1) * (1 + .5 * np.sin(2 * np.pi * 30 * x)) * .03)
    elif ty == 'coo': add(fol, t, coo(v, e.get('eep', 0)))
    elif ty == 'paper': x = tt(.35); add(fol, t, hp(noise(.35), 1500) * (np.exp(-x * 12) + np.exp(-np.abs(x - .12) * 40) * .6) * .08)
    elif ty == 'hum': add(fol, t, hum(d, v, e.get('muffle', 0)))
    elif ty == 'bonk': x = tt(.6); add(fol, t, (np.sin(2 * np.pi * (180 + 300 * np.exp(-x * 30)) * x) * np.exp(-x * 9) * .5 + bp(noise(.6), 800, 3000) * np.exp(-x * 30) * .2 + np.sin(2 * np.pi * 523 * x) * np.exp(-x * 6) * .12) * .5 * v)
    elif ty == 'twinkle':
        for i in range(int(d / .18)): m = [84, 88, 91, 96][i % 4]; add(fol, t + i * .18, glock(m, .5))
    elif ty == 'beep':
        for i, m in enumerate((76, 72) if e.get('sad') else (72, 79)): x = tt(.22); add(fol, t + i * .25, osc(hz(m), x, 'square', 6) * env(.22, .01, .05) * .03)
    elif ty == 'creak': add(fol, t, chirp(.5, 200, 140) * env(.5, .05, .1) * .03)
    elif ty == 'squeeze':
        x = tt(d); add(fol, t, (chirp(d, 500, 900) * (.5 + .5 * np.sin(2 * np.pi * 7 * x)) * .03 + bp(noise(d), 400, 1500) * .03) * env(d, .1, .1))
    elif ty == 'pop': x = tt(.2); add(fol, t, np.sin(2 * np.pi * (300 + 900 * np.exp(-x * 40)) * x) * np.exp(-x * 25) * .3)
    elif ty == 'thump': x = tt(.4); add(fol, t, (np.sin(2 * np.pi * 70 * x) * np.exp(-x * 14) + lp(noise(.4), 800) * np.exp(-x * 25) * .4) * .5 * v)
    elif ty == 'poof' or ty == 'poofbig':
        k = 1.8 if ty == 'poofbig' else 1; x = tt(.9 * k); add(fol, t, (lp(noise(.9 * k), 1800) * np.exp(-x * 5 / k) * .3 + np.sin(2 * np.pi * 90 * x) * np.exp(-x * 10) * .2) * k ** .5)
    elif ty == 'tiptoe':
        for i in range(int(d / .22)): add(fol, t + i * .22, wood(.25, 1700 + 200 * (i % 2)))
    elif ty == 'freeze': x = tt(.35); add(fol, t, (chirp(.35, 1200, 200) * np.exp(-x * 6) * .05 + hp(noise(.35), 2000) * np.exp(-x * 12) * .04))
    elif ty == 'whoosh': add(fol, t, bp(noise(.4), 400, 2500) * np.sin(np.pi * tt(.4) / .4) ** 2 * .1 * v)
    elif ty == 'q': add(fol, t, np.sin(2 * np.pi * 660 * tt(.12)) * .04); add(fol, t + .12, np.sin(2 * np.pi * np.cumsum(np.linspace(660, 990, int(.2 * SR))) / SR) * .04)
    elif ty == 'alarm':
        x = tt(d); f = np.where((x % .8) < .4, 680, 920); s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)); add(fol, t, lp(s, 2500) * env(d, .05, .3) * .022)
    elif ty == 'scurry':
        for i in range(int(d / .085)): x = tt(.05); add(fol, t + i * .085, bp(noise(.05), 2000 + 800 * (i % 2), 6000) * np.exp(-x * 90) * .07)
    elif ty == 'clatter':
        for i in range(14):
            s0 = t + rng.random() * d; x = tt(.6); f = 600 + rng.random() * 2500
            add(fol, s0, (np.sin(2 * np.pi * f * x) * .6 + np.sin(2 * np.pi * f * 2.4 * x) * .3) * np.exp(-x * (6 + rng.random() * 8)) * .07 + bp(noise(.6), 2000, 8000) * np.exp(-x * 25) * .05)
    elif ty == 'skid': x = tt(.35); add(fol, t, (chirp(.35, 2200, 1500) * .5 + bp(noise(.35), 2000, 5000)) * env(.35, .01, .1) * .05)
    elif ty == 'whistle': pass
    elif ty == 'tumble': x = tt(d); add(fol, t, bp(noise(d), 300, 1500) * env(d, .3, .5) * .05 + bp(noise(d), 3000, 8000) * env(d, .5, .5) * .02)
    elif ty == 'zoom': x = tt(.45); add(fol, t, (bp(noise(.45), 500, 4000) * (x / .45) ** 2 * .1 + sweep(.45, 200, 900, .03)))
    elif ty == 'gleam':
        for i, m in enumerate((96, 100, 103)): add(fol, t + i * .05, glock(m, .7))
    elif ty == 'slowmo': x = tt(d); add(fol, t, (lp(noise(d), 250) * .5 + np.sin(2 * np.pi * 40 * x) * .3) * env(d, 1.5, .6) * .12 + sweep(d, 300, 60, .05))
    elif ty == 'crash':
        x = tt(2.5); add(fol, t, (np.sin(2 * np.pi * (45 + 60 * np.exp(-x * 10)) * x) * np.exp(-x * 3) * .7 + lp(noise(2.5), 2500) * np.exp(-x * 6) * .4 + bp(noise(2.5), 3000, 9000) * np.exp(-x * 9) * .1))
        for i in range(4): add(fol, t + .35 + i * .22, np.sin(2 * np.pi * 70 * tt(.3)) * np.exp(-tt(.3) * 15) * .25 * (1 - i / 4))
    elif ty == 'struggle':
        for i in range(int(d / .6)):
            s0 = t + i * .6 + rng.random() * .3
            if rng.random() < .55: x = tt(.25); add(fol, s0, lp(np.sin(2 * np.pi * (250 + rng.random() * 200) * x + 3 * np.sin(2 * np.pi * 25 * x)), 500) * np.sin(np.pi * x / .25) * .06)
            if rng.random() < .35: x = tt(.12); add(fol, s0 + .3, lp(noise(.12), 400) * np.exp(-x * 30) * .1)
    elif ty == 'medal':
        for i, m in enumerate((72, 76, 79, 84)): add(mus, t + i * .11, brass(m, .5 if i < 3 else 1.4, 1.1))
        add(mus, t + .33, timp(36, 1))
    elif ty == 'pull': add(fol, t, chirp(.35, 400, 1200) * env(.35, .05, .05) * .05); add(fol, t + .35, np.sin(2 * np.pi * (300 + 900 * np.exp(-tt(.15) * 40)) * tt(.15)) * np.exp(-tt(.15) * 25) * .3)
    elif ty == 'clang': x = tt(1.2); add(fol, t, (np.sin(2 * np.pi * 1180 * x) + .6 * np.sin(2 * np.pi * 2710 * x) + .3 * np.sin(2 * np.pi * 4300 * x)) * np.exp(-x * 4) * .06)
    elif ty == 'chime':
        for i, m in enumerate((79, 84, 88, 91)): add(mus, t + i * .08, glock(m, 1))
    elif ty == 'cough':
        for i in range(3): x = tt(.15); add(fol, t + i * .22, osc(hz(52 - i), x, 'square', 6) * env(.15, .005, .05) * .03 + lp(noise(.15), 1500) * np.exp(-x * 20) * .05)
    elif ty == 'laugh':
        for i in range(int(d / .2)): x = tt(.15); f = 260 - i * 3; add(fol, t + i * .2, lp(np.sin(2 * np.pi * f * x + 2 * np.sin(2 * np.pi * f * 2 * x)), 1500) * np.sin(np.pi * x / .15) * .035 * (1 - i / (d / .2)))
    elif ty == 'jump': add(fol, t, sweep(.5, 300, 900, .03) + bp(noise(.5), 500, 3000)[:int(.5 * SR)] * env(.5, .05, .2) * .05)
    elif ty == 'munch':
        for i in range(int(d / .28)): x = tt(.1); add(fol, t + i * .28 + rng.random() * .04, bp(noise(.1), 1500, 6000) * np.exp(-x * 40) * .08)
    elif ty == 'purr': x = tt(d); add(fol, t, lp(noise(d), 200) * (.6 + .4 * np.sin(2 * np.pi * 24 * x)) * (.6 + .4 * np.sin(2 * np.pi * .5 * x)) * env(d, .5, .5) * .2)
    elif ty == 'narrow': add(fol, t, sweep(.6, 900, 250, .03) + osc(hz(40), tt(.6), 'square', 5) * env(.6, .02, .3) * .02)
IR = noise(1.6) * np.exp(-np.arange(int(1.6 * SR)) / SR * 3.2); IR = lp(IR, 5000); IR /= np.sqrt((IR ** 2).sum())
music = mus * .85 + fftconvolve(mus, IR)[:N] * .35
fol = fol + fftconvolve(fol, IR)[:N] * .12
vo = np.zeros(N); vpath = os.path.join(HERE, 'voice.wav')
if os.path.exists(vpath):
    v, vsr = sf.read(vpath, always_2d=True); v = v.mean(1)
    if vsr != SR:
        import soxr; v = soxr.resample(v, vsr, SR)
    en = np.sqrt(lp(v ** 2, 20).clip(1e-9)); v = v * np.where(en > .08, (.08 / en) ** .5, 1.0)
    add(vo, json.load(open(os.path.join(HERE, 'voice.json')))['offset'], v)
    venv = np.sqrt(lp(vo ** 2, 5).clip(0)); duck = 1 - .55 * np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
else: duck = np.ones(N)
mix = music * duck + fol * (.6 + .4 * duck) + vo * 1.9
mix = hp(mix, 30)
rms = np.sqrt(lp(mix ** 2, 3).clip(1e-12)).mean() * 3.5
pk = maximum_filter1d(np.abs(mix), int(.01 * SR)); gn = lp(np.minimum(1, rms / (pk + 1e-9)), 40).clip(.05, 1); mix = mix * gn
mix = np.tanh(mix * 1.1) / 1.1; mix = mix[:int(DUR * SR)]; mix *= np.minimum(1, (DUR - np.arange(len(mix)) / SR) / 1.5)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), np.stack([mix, mix], 1) * .8, SR, subtype='PCM_24')
print('mix ok', round(len(mix) / SR, 2), 's, voice:', os.path.exists(vpath))
