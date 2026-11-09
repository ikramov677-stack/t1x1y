"""Warm, sleepy score (soft pads, lazy piano) + foley + optional voice → out/mix.wav."""
import json, os
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.ndimage import maximum_filter1d
HERE = os.path.dirname(os.path.abspath(__file__)); SR = 48000
E = json.load(open(os.path.join(HERE, 'events.json'))); DUR = E['dur']; EV = E['ev']
N = int((DUR + 3) * SR); rng = np.random.default_rng(44); BPM = 72; BEAT = 60 / BPM; BAR = BEAT * 4
cuts = {e['name']: (e['t'], e['t'] + e['d']) for e in EV if e['type'] == 'cut'}
def hash(n): return (np.sin(n * 127.1 + 311.7) * 43758.5453) % 1
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
light_start = cuts['sub'][0]
DREAM = [[41, 53, 57, 60], [36, 52, 55, 60], [38, 50, 53, 57], [34, 50, 53, 58]]   # F – C – Dm – Bb
t = 0.0; k = 0
while t < DUR:
    ch = DREAM[k % 4]; d = BAR; lightm = t >= light_start - .1
    add(mus, t, pad(ch, d + 2, 1.0, 1400 if not lightm else 2400)); add(mus, t, pad([ch[0] - 12], d + 2, 1.1, 260))
    for j in range(8):
        m = [ch[1], ch[2], ch[3], ch[2] + 12][(j * 3 + k) % 4] + 12
        if j % 2 == 0 or lightm or hash(k * 9 + j) > .5: add(mus, t + j * BEAT / 2, piano(m + 12, 2.5, .45))
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
    elif ty == 'gasp': x = tt(.7); add(fol, t, bp(noise(.7), 600, 3500) * np.sin(np.pi * x / .7) ** .5 * np.exp(-x * 3) * .12); add(fol, t, hp(noise(.4), 2000) * np.exp(-tt(.4) * 12) * .05)
    elif ty == 'dissolve': x = tt(d); add(fol, t, bp(noise(d), 3000, 9000) * np.sin(np.pi * x / d) ** 2 * .05); add(mus, t, sweep(d, 1800, 600, .02))
    elif ty == 'night':
        for i in range(int(d / .4)):
            if rng.random() < .6: x = tt(.05); add(fol, t + i * .4 + rng.random() * .1, np.sin(2 * np.pi * 4300 * x) * np.sin(np.pi * x / .05) * .01)
    elif ty == 'bloop': x = tt(1.2); m = [74, 78, 81, 85, 86][e.get('k', 0) % 5]; add(mus, t, np.sin(2 * np.pi * hz(m) * x + 2 * np.sin(2 * np.pi * hz(m) * 2 * x) * np.exp(-x * 8)) * np.exp(-x * 3) * .05)
    elif ty == 'flutter': x = tt(d); add(fol, t, bp(noise(d), 400, 2000) * (.5 + .5 * np.sin(2 * np.pi * 9 * x)) * env(d, .3, .3) * .03)
    elif ty == 'neural':
        for i in range(int(d / .15)):
            if rng.random() < .5: x = tt(.2); add(mus, t + i * .15, np.sin(2 * np.pi * (1500 + rng.random() * 2500) * x) * np.exp(-x * 25) * .015)
    elif ty == 'beep': x = tt(.6); add(fol, t, np.sin(2 * np.pi * 880 * x) * (x < .15) * .05 + np.sin(2 * np.pi * 440 * x) * ((x > .25) & (x < .55)) * .05)
    elif ty == 'heart':
        for i in range(int(d / 1.0)):
            for j, dt in enumerate((0, .28)): x = tt(.25); add(fol, t + i * 1.0 + dt, np.sin(2 * np.pi * 50 * x) * np.exp(-x * 20) * (.25 if j == 0 else .18))
    elif ty == 'lock': x = tt(.3); add(fol, t, hp(noise(.3), 2000) * np.exp(-x * 60) * .2 + np.sin(2 * np.pi * 120 * x) * np.exp(-x * 20) * .2); add(mus, t + .05, np.sin(2 * np.pi * hz(88) * tt(1.5)) * np.exp(-tt(1.5) * 3) * .04)
    elif ty == 'pop': x = tt(.15); add(fol, t, np.sin(2 * np.pi * np.cumsum(np.linspace(300, 900, len(x))) / SR) * np.exp(-x * 30) * .12)
    elif ty == 'write':
        for i in range(int(d / .18)): x = tt(.14); add(fol, t + i * .18 + rng.random() * .04, bp(noise(.14), 2500, 7000) * np.sin(np.pi * x / .14) * .03)
    elif ty == 'yawn':
        f = e.get('f', 1.0); x = tt(d); f0 = 210 * f * (1 + .25 * np.sin(np.pi * np.minimum(1, x / d) * .9)) * np.exp(-x / d * .5)
        src = np.sign(np.sin(2 * np.pi * np.cumsum(f0) / SR)) * .5 + bp(noise(d), 400, 3000) * .8
        vow = bp(src, 500 * f, 1300 * f) + .5 * bp(src, 900 * f, 2200 * f)
        add(fol, t, vow * np.sin(np.pi * np.minimum(1, x / d)) ** 1.5 * .09 * v)
    elif ty == 'dogyawn':
        x = tt(d); f0 = 520 * (1 + .4 * np.sin(np.pi * x / d)) * np.exp(-x / d * .9); src = np.sin(2 * np.pi * np.cumsum(f0) / SR) + .3 * np.sign(np.sin(2 * np.pi * np.cumsum(f0) / SR))
        add(fol, t, (bp(src, 600, 3000) * .5 + bp(noise(d), 1000, 4000) * .2) * np.sin(np.pi * x / d) ** 2 * .1)
    elif ty == 'page': x = tt(.5); add(fol, t, bp(noise(.5), 1500, 7000) * np.sin(np.pi * x / .5) ** 3 * .1)
    elif ty == 'ding':
        for j, m in enumerate((84, 91)): x = tt(1.5); add(mus, t + j * .07, np.sin(2 * np.pi * hz(m) * x) * np.exp(-x * 3) * .05)
    elif ty == 'womb':
        x = tt(d); add(fol, t, lp(noise(d), 300) * env(d, .5, .5) * .25)
        for i in range(int(d / .43)): xx = tt(.35); add(fol, t + i * .43, lp(noise(.35), 200) * np.sin(np.pi * xx / .35) ** 2 * .35)
    elif ty == 'air': x = tt(d); add(fol, t, bp(noise(d), 500, 6000) * np.sin(np.pi * x / d) ** 2 * .1); add(mus, t, sweep(d, 900, 2200, .015))
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
