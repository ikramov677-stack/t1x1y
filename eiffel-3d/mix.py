"""Playful Paris score (accordion lead, ukulele, pizzicato bass, light drums, glockenspiel) + foley + optional voice → out/mix.wav."""
import json, os
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.ndimage import maximum_filter1d
HERE = os.path.dirname(os.path.abspath(__file__)); SR = 48000
E = json.load(open(os.path.join(HERE, 'events.json'))); DUR = E['dur']; EV = E['ev']
N = int((DUR + 2) * SR); rng = np.random.default_rng(9)
BPM = 112; BEAT = 60 / BPM; BAR = BEAT * 4
cuts = {e['name']: (e['t'], e['t'] + e['d']) for e in EV if e['type'] == 'cut'}
def tt(d): return np.arange(int(d * SR)) / SR
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b): return sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), x)
def noise(d): return rng.standard_normal(int(d * SR))
def add(buf, at, sig, g=1.0):
    i = int(at * SR)
    if i < 0: sig = sig[-i:]; i = 0
    j = min(len(buf), i + len(sig))
    if j > i: buf[i:j] += sig[:j - i] * g
def accordion(m, d, v=1.0):
    x = tt(d); f = hz(m); s = 0
    for det in (-.004, .0, .005):
        ph = 2 * np.pi * f * (1 + det) * x; s = s + np.sign(np.sin(ph)) * .4 + np.sin(ph) * .6
    env = np.minimum(1, x / .04) * np.minimum(1, np.maximum(0, d - x) / .06) * (1 + .12 * np.sin(2 * np.pi * 5.5 * x))
    return lp(s, 2600) * env * .05 * v
def uke(ms, v=1.0):
    out = np.zeros(int(.8 * SR))
    for k, m in enumerate(ms):
        x = tt(.8 - k * .015); s = np.sin(2 * np.pi * hz(m) * x) + .5 * np.sin(4 * np.pi * hz(m) * x) * np.exp(-x * 9)
        out[int(k * .015 * SR):int(k * .015 * SR) + len(x)] += s * np.exp(-x * 5) * .05
    return out * v
def pizz(m, v=1.0): x = tt(.4); return (np.sin(2 * np.pi * hz(m) * x) + .3 * np.sin(4 * np.pi * hz(m) * x)) * np.exp(-x * 9) * .22 * v
def kick(v=1.0): x = tt(.25); return np.sin(2 * np.pi * (50 + 80 * np.exp(-x * 30)) * x) * np.exp(-x * 12) * .35 * v
def snap(v=1.0): x = tt(.12); return bp(noise(.12), 1500, 6000) * np.exp(-x * 40) * .22 * v
def glock(m, v=1.0): x = tt(1.5); return (np.sin(2 * np.pi * hz(m) * x) + .4 * np.sin(2 * np.pi * hz(m) * 2.76 * x) * np.exp(-x * 6)) * np.exp(-x * 2.5) * .08 * v
# C major waltz-ish swing in 4/4: C – Am – F – G7, melody per bar
PROG = [(48, [60, 64, 67]), (45, [60, 64, 69]), (41, [60, 65, 69]), (43, [59, 62, 67])]
MEL = [[76, 74, 72, 74], [72, 71, 69, 71], [69, 72, 77, 76], [74, 72, 71, 74]]
mus = np.zeros(N); drm = np.zeros(N)
def groove(t0, t1, lvl=1.0, lead=True, drums=True):
    b = 0
    while t0 + b * BEAT < t1 - .05:
        t = t0 + b * BEAT; bar = int(t / BAR) % 4; root, ch = PROG[bar]; beat = b % 4
        add(mus, t, pizz(root if beat % 2 == 0 else root + 7, lvl))
        if beat in (1, 3): add(mus, t, uke([m + 12 for m in ch], lvl))
        if lead: add(mus, t, accordion(MEL[bar][beat] + (0 if (int(t / BAR) // 4) % 2 == 0 else -12 + 12), BEAT * .92, lvl))
        if drums: add(drm, t, kick(lvl) if beat in (0, 2) else snap(lvl))
        b += 1
names = [n for n in cuts]
for n in names:
    a0, a1 = cuts[n]
    if n in ('hate', 'artists', 'dismantle'):   # minor turn: drums out, sparse low accordion
        b = 0
        while a0 + b * BEAT < a1 - .05:
            t = a0 + b * BEAT
            if b % 2 == 0: add(mus, t, accordion([57, 55, 53, 52][(b // 2) % 4], BEAT * 1.8, .9)); add(mus, t, pizz(45 if b % 4 == 0 else 40, .8))
            b += 1
    elif n in ('expo', 'tallest', 'sub'): groove(a0, a1, 1.15)
    elif n in ('newspaper',): pass
    else: groove(a0, a1, .9, lead=n not in ('iron', 'eiffel'))
fol = np.zeros(N)
for e in EV:
    t, ty, d, v = e['t'], e['type'], e.get('d', .5), e.get('v', 1.0)
    if ty == 'pop': x = tt(.12); add(fol, t, np.sin(2 * np.pi * (300 + 1100 * x / .12) * x) * np.exp(-x * 30) * .18 * v)
    elif ty == 'cut': x = tt(.35); add(fol, t - .12, bp(noise(.35), 500, 4000) * np.sin(np.pi * x / .35) ** 2 * .12)
    elif ty == 'sizzle': x = tt(d); add(fol, t, hp(noise(d), 4000) * (.6 + .4 * np.sin(2 * np.pi * 7 * x)) * np.minimum(1, np.minimum(x, d - x) / .3) * .05)
    elif ty == 'stretch': x = tt(d); add(fol, t, np.sin(2 * np.pi * np.cumsum(np.linspace(200, 700, len(x))) / SR) * np.sin(np.pi * x / d) * .06)
    elif ty == 'ding': add(mus, t, glock(88, 1.2)); add(mus, t + .12, glock(91, 1.0))
    elif ty == 'wind': x = tt(d); add(fol, t, bp(noise(d), 250, 1400) * (.6 + .4 * np.sin(2 * np.pi * .5 * x)) * np.minimum(1, np.minimum(x, d - x) / .5) * .09 * v)
    elif ty == 'creak': x = tt(d); add(fol, t, bp(noise(d), 300, 900) * (.5 + .5 * np.sign(np.sin(2 * np.pi * 9 * x))) * np.sin(np.pi * x / d) * .07)
    elif ty == 'roll':
        for k in range(int(d / .06)): x = tt(.02); add(fol, t + k * .06, hp(noise(.02), 3000) * np.exp(-x * 250) * .08)
    elif ty == 'clank': x = tt(.5); add(fol, t, sum(np.sin(2 * np.pi * f * x) for f in (520, 1310, 2210)) * np.exp(-x * 9) * .06)
    elif ty == 'fanfare':
        for k, m in enumerate([72, 76, 79, 84]): add(mus, t + k * .1, accordion(m, .5 if k < 3 else 1.0, 1.4))
    elif ty == 'crowd' or ty == 'boo':
        x = tt(d); base = bp(noise(d), 200 if ty == 'boo' else 400, 900 if ty == 'boo' else 2500)
        mod = .6 + .4 * np.sin(2 * np.pi * (1.3 if ty == 'boo' else 3.1) * x)
        add(fol, t, base * mod * np.minimum(1, np.minimum(x, d - x) / .4) * (.12 if ty == 'boo' else .06) * v)
    elif ty == 'flip':
        for k in range(int(d / .14)): x = tt(.08); add(fol, t + k * .14, bp(noise(.08), 1500, 6000) * np.exp(-x * 40) * .1)
    elif ty == 'radio':
        for k in range(int(d / .5)): x = tt(.12); add(fol, t + k * .5, np.sin(2 * np.pi * 1200 * x) * .05 * (x < .1)); x2 = tt(.4); add(fol, t + k * .5 + .15, hp(noise(.4), 2500) * np.exp(-x2 * 8) * .03)
    elif ty == 'brush': x = tt(d); add(fol, t, bp(noise(d), 1500, 5000) * np.abs(np.sin(2 * np.pi * 3 * x)) * .05)
    elif ty == 'shutter': x = tt(.08); add(fol, t, hp(noise(.08), 2000) * np.exp(-x * 60) * .2)
    elif ty == 'whoosh': x = tt(.8); add(fol, t, bp(noise(.8), 300, 3000) * np.sin(np.pi * x / .8) ** 2 * .2)
IR = noise(1.2) * np.exp(-np.arange(int(1.2 * SR)) / SR * 4.0); IR = lp(IR, 5000); IR /= np.sqrt((IR ** 2).sum())
music = mus + drm * .8; music = music * .85 + fftconvolve(music, IR)[:N] * .22
vo = np.zeros(N); vpath = os.path.join(HERE, 'voice.wav')
if os.path.exists(vpath):
    v, vsr = sf.read(vpath, always_2d=True); v = v.mean(1)
    if vsr != SR:
        import soxr; v = soxr.resample(v, vsr, SR)
    env = np.sqrt(lp(v ** 2, 20).clip(1e-9)); v = v * np.where(env > .08, (.08 / env) ** .5, 1.0)
    add(vo, json.load(open(os.path.join(HERE, 'voice.json')))['offset'], v)
    venv = np.sqrt(lp(vo ** 2, 5).clip(0)); duck = 1 - .55 * np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
else: duck = np.ones(N)
mix = music * duck * .9 + fol + vo * 1.9
mix = hp(mix, 30)
rms = np.sqrt(lp(mix ** 2, 3).clip(1e-12)).mean() * 3.5
pk = maximum_filter1d(np.abs(mix), int(.01 * SR)); g = lp(np.minimum(1, rms / (pk + 1e-9)), 40).clip(.05, 1); mix = mix * g
mix = np.tanh(mix * 1.1) / 1.1; mix = mix[:int(DUR * SR)]; mix *= np.minimum(1, (DUR - np.arange(len(mix)) / SR) / 1.2)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), np.stack([mix, mix], 1) * .8, SR, subtype='PCM_24')
print('mix ok', round(len(mix) / SR, 2), 's, voice:', os.path.exists(vpath))
