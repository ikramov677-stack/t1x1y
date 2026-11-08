"""Epic score (D-minor drones, low piano, driving pulse, strings swell) + disaster foley + optional voice → out/mix.wav."""
import json, os
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.ndimage import maximum_filter1d
HERE = os.path.dirname(os.path.abspath(__file__)); SR = 48000
E = json.load(open(os.path.join(HERE, 'events.json'))); DUR = E['dur']; EV = E['ev']
N = int((DUR + 3) * SR); rng = np.random.default_rng(13); BPM = 80; BEAT = 60 / BPM; BAR = BEAT * 4
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
def pad(ms, d, v=1.0, bright=1200):
    x = tt(d); env = np.minimum(1, x / 2.0) * np.minimum(1, np.maximum(0, d - x) / 2.0)
    s = sum(np.sin(2 * np.pi * hz(m) * x * (1 + det) + .3 * np.sin(2 * np.pi * .1 * x)) + .3 * np.sign(np.sin(2 * np.pi * hz(m) * x * (1 + det))) for m in ms for det in (-.003, .003))
    return lp(s, bright) * env * .02 * v
def piano(m, d=3.0, v=1.0):
    x = tt(d); f = hz(m); s = 0
    for k, a in ((1, 1), (2, .4), (3, .18), (4, .08)): s = s + a * np.sin(2 * np.pi * f * k * x) * np.exp(-x * (1.0 + k * .7))
    return lp(s * np.minimum(1, x / .008), 2400) * .12 * v
def shimmer(m, d, v=1.0):
    x = tt(d); s = sum(np.sin(2 * np.pi * hz(m + o) * x) * (.5 + .5 * np.sin(2 * np.pi * (3 + o * .1) * x)) for o in (0, 12, 19))
    return s * np.minimum(1, x / 1.0) * np.minimum(1, np.maximum(0, d - x) / 1.0) * .012 * v
def pulse(v=1.0): x = tt(.6); return np.sin(2 * np.pi * (42 + 30 * np.exp(-x * 18)) * x) * np.exp(-x * 6) * .4 * v
mus = np.zeros(N)
# E minor, dark: Em – C – Fm(add) – Dm ; long chords, one per 2 bars
PROG = [[38, 45, 50, 53], [34, 46, 50, 53], [36, 43, 48, 52], [33, 45, 49, 52]]
t = 0.0; k = 0
while t < DUR:
    ch = PROG[k % 4]; d = BAR * 2
    lvl = .7 + .6 * (t / DUR) ** 1.5
    add(mus, t, pad(ch, d + 1.5, lvl, 900 + 1400 * t / DUR)); add(mus, t, pad([ch[0] - 12], d + 1.5, lvl * 1.3, 300))
    for j, m in enumerate([ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 24]):
        if (k + j) % 2 == 0 or t > DUR * .45: add(mus, t + j * BAR / 2, piano(m, 3.0, .8))
    if t > DUR * .05:
        for b in range(8): add(mus, t + b * BEAT, pulse(.35 + .5 * t / DUR))
    if t > DUR * .5: add(mus, t, shimmer(ch[3] + 24, d + 1, .8 + t / DUR))
    t += d; k += 1
fol = np.zeros(N)
def sweep(d, f0, f1, v): x = tt(d); return np.sin(2 * np.pi * np.cumsum(np.geomspace(f0, f1, len(x))) / SR) * np.sin(np.pi * x / d) ** 2 * v
def env(d, a=.3, r=.5): x = tt(d); return np.minimum(1, np.minimum(x / max(a, 1e-3), np.maximum(0, d - x) / max(r, 1e-3)))
for e in EV:
    t, ty, d, v = e['t'], e['type'], e.get('d', .5), e.get('v', 1.0)
    if ty == 'boom': x = tt(3.5); add(fol, t, (np.sin(2 * np.pi * (34 + 50 * np.exp(-x * 5)) * x) * np.exp(-x * 1.2) + lp(noise(3.5), 180) * np.exp(-x * 1.8) * .6) * .6 * v)
    elif ty == 'hit': x = tt(1.8); add(fol, t, (np.sin(2 * np.pi * 50 * x) * np.exp(-x * 2.5) + hp(noise(1.8), 1500) * np.exp(-x * 5) * .25) * .4 * v)
    elif ty == 'hum': x = tt(d); add(fol, t, (np.sin(2 * np.pi * 55 * x) * .5 + np.sin(2 * np.pi * 110.5 * x) * .25 + lp(noise(d), 200) * .4) * env(d, .5, .05) * .08)
    elif ty == 'stop':
        x = tt(2.5); add(fol, t, (np.sin(2 * np.pi * np.cumsum(np.geomspace(400, 30, len(x))) / SR) * np.exp(-x * 2) * .3 + hp(noise(2.5), 2000) * np.exp(-x * 8) * .2 + np.sin(2 * np.pi * 38 * x) * np.exp(-x * 1.5) * .6))
    elif ty == 'drone': x = tt(d); add(fol, t, (np.sin(2 * np.pi * 41 * x + 2 * np.sin(2 * np.pi * .3 * x)) * .5 + bp(noise(d), 80, 400) * .5) * env(d, 1, .5) * .12)
    elif ty == 'whoosh':
        for i in range(int(d / .45)): x = tt(.6); add(fol, t + i * .45 + rng.random() * .1, bp(noise(.6), 300, 2500) * np.sin(np.pi * x / .6) ** 3 * .07)
        add(fol, t, bp(noise(d), 100, 900) * env(d, .5, .5) * .05)
    elif ty == 'rise': x = tt(d); add(fol, t, bp(noise(d), 300, 3000) * (x / d) ** 2 * .08 + np.sin(2 * np.pi * np.cumsum(np.geomspace(150, 700, len(x))) / SR) * (x / d) * .04)
    elif ty == 'jet': x = tt(d); add(fol, t, (bp(noise(d), 150, 1200) * .6 + bp(noise(d), 2000, 6000) * .15 + np.sin(2 * np.pi * 180 * x) * .05) * env(d, .6, .6) * .12)
    elif ty == 'rumble': x = tt(d); add(fol, t, lp(noise(d), 90) * env(d, .5, .6) * 1.3)
    elif ty == 'debris':
        for i in range(int(d * 9)): c = tt(.25); add(fol, t + rng.random() * d, bp(noise(.25), 300 + rng.random() * 2000, 5000) * np.exp(-c * 25) * (.08 + rng.random() * .12))
    elif ty == 'storm': x = tt(d); add(fol, t, (bp(noise(d), 120, 1800) * (.6 + .4 * np.sin(2 * np.pi * .7 * x)) + lp(noise(d), 120) * 1.5) * env(d, d * .5, .4) * .25)
    elif ty == 'surf': x = tt(d); add(fol, t, (lp(noise(d), 500) * 1.2 + bp(noise(d), 800, 5000) * .3 * (x / d)) * env(d, d * .6, .4) * .22)
    elif ty == 'wind': x = tt(d); add(fol, t, bp(noise(d), 300 if e.get('cold') else 200, 2600 if e.get('cold') else 1400) * (.5 + .5 * np.sin(2 * np.pi * .23 * x)) * env(d, .8, .8) * .06)
    elif ty == 'chime':
        for j, m in enumerate((86, 90, 93)): x = tt(3); add(mus, t + j * .12, np.sin(2 * np.pi * hz(m) * x) * np.exp(-x * 1.4) * .05)
    elif ty == 'heat': x = tt(d); add(fol, t, (bp(noise(d), 2000, 7000) * .04 + np.sin(2 * np.pi * 70 * x) * .03) * env(d, .5, .5))
    elif ty == 'swap': x = tt(1.2); add(fol, t - .4, hp(noise(1.2), 800) * np.sin(np.pi * x / 1.2) ** 2 * .12)
    elif ty == 'swell': add(mus, t, shimmer(74, d, 2.0))
IR = noise(2.5) * np.exp(-np.arange(int(2.5 * SR)) / SR * 2.2); IR = lp(IR, 4500); IR /= np.sqrt((IR ** 2).sum())
music = mus * .8 + fftconvolve(mus, IR)[:N] * .45
vo = np.zeros(N); vpath = os.path.join(HERE, 'voice.wav')
if os.path.exists(vpath):
    v, vsr = sf.read(vpath, always_2d=True); v = v.mean(1)
    if vsr != SR:
        import soxr; v = soxr.resample(v, vsr, SR)
    env = np.sqrt(lp(v ** 2, 20).clip(1e-9)); v = v * np.where(env > .08, (.08 / env) ** .5, 1.0)
    add(vo, json.load(open(os.path.join(HERE, 'voice.json')))['offset'], v)
    venv = np.sqrt(lp(vo ** 2, 5).clip(0)); duck = 1 - .5 * np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
else: duck = np.ones(N)
mix = music * duck + fol + vo * 1.9
mix = hp(mix, 28)
rms = np.sqrt(lp(mix ** 2, 3).clip(1e-12)).mean() * 3.5
pk = maximum_filter1d(np.abs(mix), int(.01 * SR)); g = lp(np.minimum(1, rms / (pk + 1e-9)), 40).clip(.05, 1); mix = mix * g
mix = np.tanh(mix * 1.1) / 1.1; mix = mix[:int(DUR * SR)]; mix *= np.minimum(1, (DUR - np.arange(len(mix)) / SR) / 1.5)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), np.stack([mix, mix], 1) * .8, SR, subtype='PCM_24')
print('mix ok', round(len(mix) / SR, 2), 's, voice:', os.path.exists(vpath))
