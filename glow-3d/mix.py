"""Cinematic ambient score (drones, felt piano, shimmer pads, slow pulse, swell to the end) + foley + optional voice → out/mix.wav."""
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
# D minor / F major colours: Dm – B♭ – F – C ; long chords, one per 2 bars
PROG = [[50, 57, 62, 65], [46, 53, 58, 62], [41, 53, 57, 60], [48, 55, 60, 64]]
t = 0.0; k = 0
while t < DUR:
    ch = PROG[k % 4]; d = BAR * 2
    lvl = .7 + .6 * (t / DUR) ** 1.5
    add(mus, t, pad(ch, d + 1.5, lvl, 900 + 1400 * t / DUR)); add(mus, t, pad([ch[0] - 12], d + 1.5, lvl * 1.3, 300))
    for j, m in enumerate([ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 24]):
        if (k + j) % 2 == 0 or t > DUR * .45: add(mus, t + j * BAR / 2, piano(m, 3.0, .8))
    if t > DUR * .2:
        for b in range(8): add(mus, t + b * BEAT, pulse(.35 + .5 * t / DUR))
    if t > DUR * .5: add(mus, t, shimmer(ch[3] + 24, d + 1, .8 + t / DUR))
    t += d; k += 1
fol = np.zeros(N)
for e in EV:
    t, ty, d, v = e['t'], e['type'], e.get('d', .5), e.get('v', 1.0)
    if ty == 'boom': x = tt(3.0); add(fol, t, (np.sin(2 * np.pi * (38 + 40 * np.exp(-x * 5)) * x) * np.exp(-x * 1.4) + lp(noise(3.0), 200) * np.exp(-x * 2) * .5) * .5 * v)
    elif ty == 'hit': x = tt(1.5); add(fol, t, (np.sin(2 * np.pi * 55 * x) * np.exp(-x * 3) + hp(noise(1.5), 2000) * np.exp(-x * 6) * .2) * .35)
    elif ty == 'shimmer': add(mus, t, shimmer(81, d + .8, 1.4))
    elif ty == 'rise': x = tt(d); add(fol, t, bp(noise(d), 300, 3000) * (x / d) ** 2 * .12 + np.sin(2 * np.pi * np.cumsum(np.linspace(200, 800, len(x))) / SR) * (x / d) ** 2 * .05)
    elif ty == 'shutter': x = tt(.15); add(fol, t, hp(noise(.15), 1800) * np.exp(-x * 40) * .25)
    elif ty == 'tick':
        for i in range(int(d / .5)): x = tt(.04); add(fol, t + i * .5, bp(noise(.04), 2000, 6000) * np.exp(-x * 120) * (.2 if i % 2 else .14))
    elif ty == 'birds':
        for i in range(int(d * 1.2)):
            x = tt(.25); f = 2800 + 800 * np.sin(2 * np.pi * 16 * x); add(fol, t + .3 + i / 1.2 + (i % 3) * .13, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * x / .25) ** 2 * .025)
    elif ty == 'sparkle':
        for i in range(int(d * 5)): x = tt(.4); f = hz(84 + (i * 7) % 12); add(fol, t + i / 5, np.sin(2 * np.pi * f * x) * np.exp(-x * 9) * .03)
    elif ty == 'crickets':
        for i in range(int(d * 2)): x = tt(.25); add(fol, t + i / 2 + (i % 2) * .1, np.sin(2 * np.pi * 4300 * x) * (np.sin(2 * np.pi * 30 * x) > 0) * np.sin(np.pi * x / .25) * .025)
    elif ty == 'underwater': x = tt(d); add(fol, t, lp(noise(d), 260) * .35 * np.minimum(1, np.minimum(x, d - x) / .6)); [add(fol, t + .3 + i * .45, np.sin(2 * np.pi * np.cumsum(np.linspace(400, 900, int(.1 * SR))) / SR) * np.exp(-tt(.1) * 30) * .06) for i in range(int(d / .45))]
    elif ty == 'forest': x = tt(d); add(fol, t, bp(noise(d), 300, 1500) * (.6 + .4 * np.sin(2 * np.pi * .3 * x)) * np.minimum(1, np.minimum(x, d - x) / .6) * .05)
    elif ty == 'click': x = tt(.08); add(fol, t, bp(noise(.08), 1500, 5000) * np.exp(-x * 80) * .5)
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
