"""Night-ambient score (soft pads, low piano, clock pulse) that brightens at the end + foley + optional voice → out/mix.wav."""
import json, os
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.ndimage import maximum_filter1d
HERE = os.path.dirname(os.path.abspath(__file__)); SR = 48000
E = json.load(open(os.path.join(HERE, 'events.json'))); DUR = E['dur']; EV = E['ev']
N = int((DUR + 3) * SR); rng = np.random.default_rng(21); BPM = 72; BEAT = 60 / BPM; BAR = BEAT * 4
cuts = {e['name']: (e['t'], e['t'] + e['d']) for e in EV if e['type'] == 'cut'}
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
def pad(ms, d, v=1.0, bright=1200):
    x = tt(d); e = np.minimum(1, x / 1.5) * np.minimum(1, np.maximum(0, d - x) / 1.5)
    s = sum(np.sin(2 * np.pi * hz(m) * x * (1 + det)) + .25 * np.sign(np.sin(2 * np.pi * hz(m) * x * (1 + det))) for m in ms for det in (-.003, .003))
    return lp(s, bright) * e * .02 * v
def piano(m, d=3.0, v=1.0):
    x = tt(d); f = hz(m); s = 0
    for k, a in ((1, 1), (2, .4), (3, .18), (4, .08)): s = s + a * np.sin(2 * np.pi * f * k * x) * np.exp(-x * (1.0 + k * .7))
    return lp(s * np.minimum(1, x / .008), 2600) * .11 * v
def pulse(v=1.0): x = tt(.5); return np.sin(2 * np.pi * (46 + 30 * np.exp(-x * 20)) * x) * np.exp(-x * 7) * .35 * v
mus = np.zeros(N)
dark_end = cuts['sleep'][0]
DARK = [[45, 52, 57, 60], [41, 52, 57, 60], [43, 50, 55, 59], [40, 52, 55, 59]]     # Am – F – G – Em
LIGHT = [[48, 55, 60, 64], [43, 55, 59, 62], [45, 52, 57, 60], [41, 53, 57, 60]]    # C – G – Am – F
t = 0.0; k = 0
while t < DUR:
    lightm = t >= dark_end - .1; ch = (LIGHT if lightm else DARK)[k % 4]; d = BAR
    if not lightm and cuts['halluc'][0] - .1 <= t < cuts['halluc'][1]: ch = [ch[0], ch[1] + 1, ch[2], ch[3] + 1]
    add(mus, t, pad(ch, d + 1.5, 1.0 if not lightm else 1.2, 1000 if not lightm else 2200)); add(mus, t, pad([ch[0] - 12], d + 1.5, 1.2, 280))
    for j, m in enumerate([ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 24]):
        if lightm or (k + j) % 2 == 0: add(mus, t + j * BEAT, piano(m, 3.0, .7 if not lightm else .9))
    if not lightm and t > 1:
        for b in range(4): add(mus, t + b * BEAT, pulse(.5))
    t += d; k += 1
fol = np.zeros(N)
def sweep(d, f0, f1, v): x = tt(d); return np.sin(2 * np.pi * np.cumsum(np.geomspace(f0, f1, len(x))) / SR) * np.sin(np.pi * x / d) ** 2 * v
for e in EV:
    t, ty, d, v = e['t'], e['type'], e.get('d', .5), e.get('v', 1.0)
    if ty == 'tick':
        for i in range(int(d)): x = tt(.04); add(fol, t + i + .5, bp(noise(.04), 2500, 7000) * np.exp(-x * 140) * (.12 if i % 2 else .08))
    elif ty == 'hit': x = tt(1.8); add(fol, t, (np.sin(2 * np.pi * 48 * x) * np.exp(-x * 2.5) + hp(noise(1.8), 1500) * np.exp(-x * 6) * .2) * .4 * v)
    elif ty == 'room': x = tt(d); add(fol, t, (lp(noise(d), 400) * .5 + bp(noise(d), 1000, 3000) * .05) * env(d, .5, .5) * .08)
    elif ty == 'yawn': x = tt(1.8); add(fol, t, bp(noise(1.8), 300, 1500) * np.sin(np.pi * x / 1.8) ** 2 * .05 + np.sin(2 * np.pi * np.cumsum(np.linspace(260, 160, len(x))) / SR) * np.sin(np.pi * x / 1.8) ** 2 * .03)
    elif ty == 'ping':
        x = tt(.5); add(fol, t, (np.sin(2 * np.pi * 1320 * x) + .5 * np.sin(2 * np.pi * 1980 * x)) * np.exp(-x * 9) * .05)
    elif ty == 'drone': x = tt(d); add(fol, t, (np.sin(2 * np.pi * (38 if e.get('dark') else 44) * x + 2 * np.sin(2 * np.pi * .3 * x)) * .5 + bp(noise(d), 80, 500) * .5) * env(d, 1, .5) * (.16 if e.get('dark') else .1))
    elif ty == 'down': add(fol, t, sweep(d, 500, 60, .1)); x = tt(d); add(fol, t, lp(noise(d), 300) * (x / d) * .12)
    elif ty == 'jolt': x = tt(1.0); add(fol, t, (hp(noise(1.0), 800) * np.exp(-x * 10) * .35 + np.sin(2 * np.pi * 70 * x) * np.exp(-x * 5) * .3))
    elif ty == 'jingle':
        for i in range(10): x = tt(.25); add(fol, t + i * .045 + rng.random() * .02, bp(noise(.25), 4000, 9000) * np.exp(-x * 25) * .12 + np.sin(2 * np.pi * (3000 + rng.random() * 2500) * x) * np.exp(-x * 30) * .03)
    elif ty == 'glitch':
        for i in range(int(d / .09)):
            if rng.random() < .5: x = tt(.06); add(fol, t + i * .09, np.sign(np.sin(2 * np.pi * (200 + rng.random() * 1800) * x)) * np.exp(-x * 40) * .035)
    elif ty == 'creep': x = tt(d); add(fol, t, (sweep(d, 70, 140, .12) + bp(noise(d), 200, 900) * (x / d) ** 2 * .15 + np.sin(2 * np.pi * 311 * x) * np.sin(2 * np.pi * 329.6 * x) * (x / d) * .05))
    elif ty == 'shutter': x = tt(.3); add(fol, t, hp(noise(.3), 1200) * (np.exp(-x * 60) + .6 * np.exp(-np.abs(x - .08) * 120)) * .2)
    elif ty == 'tally':
        for i in range(11): x = tt(.12); add(fol, t + i * d / 11, bp(noise(.12), 1500, 5000) * np.sin(np.pi * x / .12) * .06)
    elif ty == 'stamp': x = tt(.8); add(fol, t, (np.sin(2 * np.pi * 70 * x) * np.exp(-x * 12) * .5 + lp(noise(.8), 1200) * np.exp(-x * 18) * .4))
    elif ty == 'calm': x = tt(d); add(fol, t, lp(noise(d), 600) * env(d, 1, 1) * .025)
    elif ty == 'shimmer':
        for i in range(10): x = tt(1.5); m = [84, 88, 91, 96, 100][i % 5]; add(mus, t + i * .22, np.sin(2 * np.pi * hz(m) * x) * np.exp(-x * 3) * .03)
    elif ty == 'birds':
        for i in range(int(d / .5)):
            if rng.random() < .5: s0 = t + i * .5 + rng.random() * .3; x = tt(.12); f0 = 2800 + rng.random() * 1500; add(fol, s0, np.sin(2 * np.pi * np.cumsum(f0 + 900 * np.sin(np.pi * x / .12)) / SR) * np.sin(np.pi * x / .12) * .025)
    elif ty == 'swell': x = tt(d); add(mus, t, pad([72, 76, 79], d, .8, 3000))
    elif ty == 'click': x = tt(.05); add(fol, t, hp(noise(.05), 1500) * np.exp(-x * 120) * .25)
    elif ty == 'chime':
        for j, m in enumerate((79, 84, 88, 91)): x = tt(1.8); add(mus, t + j * .08, np.sin(2 * np.pi * hz(m) * x) * np.exp(-x * 2.5) * .05)
IR = noise(2.2) * np.exp(-np.arange(int(2.2 * SR)) / SR * 2.6); IR = lp(IR, 4500); IR /= np.sqrt((IR ** 2).sum())
music = mus * .8 + fftconvolve(mus, IR)[:N] * .45
vo = np.zeros(N); vpath = os.path.join(HERE, 'voice.wav')
if os.path.exists(vpath):
    v, vsr = sf.read(vpath, always_2d=True); v = v.mean(1)
    if vsr != SR:
        import soxr; v = soxr.resample(v, vsr, SR)
    en = np.sqrt(lp(v ** 2, 20).clip(1e-9)); v = v * np.where(en > .08, (.08 / en) ** .5, 1.0)
    add(vo, json.load(open(os.path.join(HERE, 'voice.json')))['offset'], v)
    venv = np.sqrt(lp(vo ** 2, 5).clip(0)); duck = 1 - .5 * np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
else: duck = np.ones(N)
mix = music * duck + fol + vo * 1.9
mix = hp(mix, 28)
rms = np.sqrt(lp(mix ** 2, 3).clip(1e-12)).mean() * 3.5
pk = maximum_filter1d(np.abs(mix), int(.01 * SR)); gn = lp(np.minimum(1, rms / (pk + 1e-9)), 40).clip(.05, 1); mix = mix * gn
mix = np.tanh(mix * 1.1) / 1.1; mix = mix[:int(DUR * SR)]; mix *= np.minimum(1, (DUR - np.arange(len(mix)) / SR) / 1.5)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), np.stack([mix, mix], 1) * .8, SR, subtype='PCM_24')
print('mix ok', round(len(mix) / SR, 2), 's, voice:', os.path.exists(vpath))
