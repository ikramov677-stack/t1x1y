"""Playful score (plucks, bass, light percussion, C major) + cartoon foley + optional voice → out/mix.wav."""
import json, os
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.ndimage import maximum_filter1d
HERE = os.path.dirname(os.path.abspath(__file__)); SR = 48000
E = json.load(open(os.path.join(HERE, 'events.json'))); DUR = E['dur']; EV = E['ev']
N = int((DUR + 3) * SR); rng = np.random.default_rng(7); BPM = 104; BEAT = 60 / BPM; BAR = BEAT * 4
def tt(d): return np.arange(int(d * SR)) / SR
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b): return sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), x)
def noise(d): return rng.standard_normal(int(d * SR))
def env(d, a, r): x = tt(d); return np.minimum(1, x / max(a, 1e-3)) * np.minimum(1, np.maximum(0, d - x) / max(r, 1e-3))
def add(buf, at, sig, g=1.0):
    i = int(at * SR)
    if i < 0: sig = sig[-i:]; i = 0
    j = min(len(buf), i + len(sig))
    if j > i: buf[i:j] += sig[:j - i] * g
def pluck(m, d=.9, v=1.0, bright=1.0):
    x = tt(d); f = hz(m); s = 0
    for k, a in ((1, 1), (2, .5 * bright), (3, .25 * bright), (4, .12 * bright)): s = s + a * np.sin(2 * np.pi * f * k * x) * np.exp(-x * (3 + k * 2.5))
    return s * np.minimum(1, x / .004) * .09 * v
def marimba(m, v=1.0): x = tt(.7); f = hz(m); return (np.sin(2 * np.pi * f * x) + .3 * np.sin(2 * np.pi * f * 4 * x) * np.exp(-x * 30)) * np.exp(-x * 7) * .08 * v
def bass(m, d, v=1.0): x = tt(d); f = hz(m); return lp(np.sin(2 * np.pi * f * x) + .4 * np.sin(2 * np.pi * 2 * f * x), 500) * np.exp(-x * 2.5) * np.minimum(1, x / .01) * .16 * v
def kick(v=1.0): x = tt(.3); return np.sin(2 * np.pi * (50 + 90 * np.exp(-x * 30)) * x) * np.exp(-x * 14) * .35 * v
def shaker(v=1.0): x = tt(.08); return hp(noise(.08), 5000) * np.exp(-x * 60) * .05 * v
def clap(v=1.0): x = tt(.2); return bp(noise(.2), 900, 4000) * (np.exp(-x * 30) + .5 * np.exp(-np.abs(x - .012) * 300)) * .1 * v
mus = np.zeros(N); drums = np.zeros(N)
quiet = [(e['t'], e['t'] + e['d']) for e in EV if e['type'] == 'night']
def is_quiet(t): return any(a - .3 <= t < b for a, b in quiet)
# C – Am – F – G, bouncy pluck arpeggios
PROG = [[48, 60, 64, 67], [45, 57, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62]]
PAT = [0, 2, 1, 3, 2, 1, 3, 2]
t = 0.0; k = 0
while t < DUR:
    ch = PROG[k % 4]; q = is_quiet(t)
    add(mus, t, bass(ch[0], BEAT * 1.5, .6 if q else 1)); add(mus, t + BEAT * 2, bass(ch[0] + (7 if k % 2 else 12), BEAT * 1.5, .5 if q else .9))
    for i in range(8):
        n = ch[1:][PAT[i] % 3] + (12 if PAT[i] == 3 else 0)
        add(mus, t + i * BEAT / 2, pluck(n + 12, .8, (.55 if q else .9) * (1.1 if i % 2 == 0 else .8)))
    if k % 2 == 1 and not q:
        for i, n in enumerate((ch[3] + 24, ch[2] + 24, ch[3] + 24)): add(mus, t + BEAT * 2.5 + i * BEAT / 2, marimba(n, .8))
    if not q and t > BAR * .99:
        for b in range(4):
            add(drums, t + b * BEAT, kick(.8 if b % 2 == 0 else .5))
            if b % 2 == 1: add(drums, t + b * BEAT, clap(.8))
            for h in range(2): add(drums, t + b * BEAT + h * BEAT / 2, shaker(1.0 if h else .6))
    if q:
        for i, n in enumerate((ch[3] + 24, ch[2] + 24)): add(mus, t + i * BAR / 2, marimba(n, .6))
    t += BAR; k += 1
fol = np.zeros(N)
def sweep(d, f0, f1, v): x = tt(d); return np.sin(2 * np.pi * np.cumsum(np.geomspace(f0, f1, len(x))) / SR) * np.sin(np.pi * x / d) ** 2 * v
for e in EV:
    t, ty, d, v = e['t'], e['type'], e.get('d', .5), e.get('v', 1.0)
    if ty == 'pop': x = tt(.15); add(fol, t, np.sin(2 * np.pi * np.cumsum(np.linspace(300, 900, len(x))) / SR) * np.exp(-x * 30) * .18 * v)
    elif ty == 'sip': x = tt(.6); add(fol, t, bp(noise(.6), 1500, 5000) * (np.sin(np.pi * x / .6) ** 2) * (.5 + .5 * np.sin(2 * np.pi * 18 * x)) * .06)
    elif ty == 'whoosh': x = tt(d); add(fol, t, bp(noise(d), 300, 3500) * np.exp(-x * .8) * np.minimum(1, x / .15) * .14); add(fol, t, sweep(min(d, 1.2), 900, 200, .05))
    elif ty == 'swish': x = tt(d); add(fol, t, bp(noise(d), 600, 5000) * np.sin(np.pi * x / d) ** 3 * .07)
    elif ty == 'ding':
        for j, m in enumerate((84, 91)): x = tt(1.5); add(mus, t + j * .07, np.sin(2 * np.pi * hz(m) * x) * np.exp(-x * 3) * .06)
    elif ty == 'hum': x = tt(d); add(fol, t, (lp(noise(d), 350) * .8 + np.sin(2 * np.pi * 110 * x) * .05) * env(d, .4, .4) * .12)
    elif ty == 'pour': x = tt(d); add(fol, t, bp(noise(d), 800, 3500) * (.6 + .4 * np.sin(2 * np.pi * 9 * x + np.sin(2 * np.pi * 2 * x))) * env(d, .1, .2) * .05 + np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, len(x))) / SR) * env(d, .1, .2) * .012)
    elif ty == 'screech': x = tt(d); add(fol, t, (bp(noise(d), 2000, 4500) * .12 + np.sin(2 * np.pi * (2400 + 200 * np.sin(2 * np.pi * 30 * x)) * x) * .025) * np.exp(-x * 2.2) * np.minimum(1, x / .03))
    elif ty == 'boing': x = tt(.6); add(fol, t, np.sin(2 * np.pi * np.cumsum(180 + 120 * np.sin(2 * np.pi * 14 * x) * np.exp(-x * 4)) / SR) * np.exp(-x * 5) * .2 * v)
    elif ty == 'crash':
        for i in range(7): x = tt(.4); add(fol, t + i * .015, hp(noise(.4), 2500) * np.exp(-x * (12 + i * 3)) * .12)
        x = tt(.5); add(fol, t, bp(noise(.5), 300, 1500) * np.exp(-x * 9) * .15)
    elif ty == 'birds':
        for i in range(int(d / .6)):
            if rng.random() < .55: s0 = t + i * .6 + rng.random() * .3; x = tt(.12); f0 = 2800 + rng.random() * 1500; add(fol, s0, np.sin(2 * np.pi * np.cumsum(f0 + 900 * np.sin(np.pi * x / .12)) / SR) * np.sin(np.pi * x / .12) * .03)
    elif ty == 'wind': x = tt(d); add(fol, t, bp(noise(d), 250, 1600) * (.5 + .5 * np.sin(2 * np.pi * .3 * x)) * env(d, .6, .6) * .04)
    elif ty == 'night':
        for i in range(int(d / .35)):
            if rng.random() < .7: x = tt(.05); add(fol, t + i * .35 + rng.random() * .1, np.sin(2 * np.pi * 4300 * x) * np.sin(np.pi * x / .05) * .012)
    elif ty == 'twinkle':
        for i in range(int(d / .45)): m = [88, 91, 95, 96, 100][int(rng.random() * 5)]; x = tt(1.0); add(mus, t + i * .45, np.sin(2 * np.pi * hz(m) * x) * np.exp(-x * 4) * .025)
    elif ty == 'click': x = tt(.05); add(fol, t, hp(noise(.05), 1500) * np.exp(-x * 120) * .25)
    elif ty == 'chime':
        for j, m in enumerate((79, 84, 88, 91)): x = tt(1.8); add(mus, t + j * .08, np.sin(2 * np.pi * hz(m) * x) * np.exp(-x * 2.5) * .05)
IR = noise(1.6) * np.exp(-np.arange(int(1.6 * SR)) / SR * 3.5); IR = lp(IR, 5000); IR /= np.sqrt((IR ** 2).sum())
music = mus * .85 + fftconvolve(mus, IR)[:N] * .3 + drums
vo = np.zeros(N); vpath = os.path.join(HERE, 'voice.wav')
if os.path.exists(vpath):
    v, vsr = sf.read(vpath, always_2d=True); v = v.mean(1)
    if vsr != SR:
        import soxr; v = soxr.resample(v, vsr, SR)
    en = np.sqrt(lp(v ** 2, 20).clip(1e-9)); v = v * np.where(en > .08, (.08 / en) ** .5, 1.0)
    add(vo, json.load(open(os.path.join(HERE, 'voice.json')))['offset'], v)
    venv = np.sqrt(lp(vo ** 2, 5).clip(0)); duck = 1 - .55 * np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
else: duck = np.ones(N)
mix = music * duck + fol + vo * 1.9
mix = hp(mix, 30)
rms = np.sqrt(lp(mix ** 2, 3).clip(1e-12)).mean() * 3.5
pk = maximum_filter1d(np.abs(mix), int(.01 * SR)); gn = lp(np.minimum(1, rms / (pk + 1e-9)), 40).clip(.05, 1); mix = mix * gn
mix = np.tanh(mix * 1.1) / 1.1; mix = mix[:int(DUR * SR)]; mix *= np.minimum(1, (DUR - np.arange(len(mix)) / SR) / 1.5)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), np.stack([mix, mix], 1) * .8, SR, subtype='PCM_24')
print('mix ok', round(len(mix) / SR, 2), 's, voice:', os.path.exists(vpath))
