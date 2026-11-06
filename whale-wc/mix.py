"""Gentle score (felt piano, kalimba, pad, glockenspiel) + foley + optional voice → out/mix.wav. Reads events.json."""
import json, os
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve
HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
E = json.load(open(os.path.join(HERE, 'events.json'))); DUR = E['dur']; EV = E['ev']
N = int((DUR + 2) * SR); rng = np.random.default_rng(5)
BPM = 72; BEAT = 60 / BPM; BAR = BEAT * 4
cuts = {e['name']: (e['t'], e['t'] + e['d']) for e in EV if e['type'] == 'cut'}
def tt(d): return np.arange(int(d * SR)) / SR
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b): return sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), x)
def add(buf, at, sig, g=1.0):
    i = int(at * SR)
    if i < 0: sig = sig[-i:]; i = 0
    j = min(len(buf), i + len(sig))
    if j > i: buf[i:j] += sig[:j - i] * g
def piano(m, d=2.5, v=1.0):   # felt piano: soft hammer, inharmonic partials, felt low-pass
    x = tt(d); f = hz(m); s = 0
    for k, a in ((1, 1), (2, .45), (3, .22), (4, .1), (5, .05)): s = s + a * np.sin(2 * np.pi * f * k * np.sqrt(1 + .0004 * k * k) * x) * np.exp(-x * (1.2 + k * .6))
    s *= np.minimum(1, x / .006)
    return lp(s, 2200) * .16 * v
def kalimba(m, v=1.0):
    x = tt(1.4); f = hz(m)
    return (np.sin(2 * np.pi * f * x) + .3 * np.sin(2 * np.pi * f * 5.4 * x) * np.exp(-x * 25)) * np.exp(-x * 4) * .1 * v
def glock(m, v=1.0):
    x = tt(2.0); f = hz(m)
    return (np.sin(2 * np.pi * f * x) + .4 * np.sin(2 * np.pi * f * 2.76 * x) * np.exp(-x * 6)) * np.exp(-x * 2.2) * .07 * v
def pad(ms, d, v=1.0):
    x = tt(d); env = np.minimum(1, x / 1.2) * np.minimum(1, np.maximum(0, d - x) / 1.2)
    return sum(np.sin(2 * np.pi * hz(m) * x * (1 + dt) + .2 * np.sin(2 * np.pi * .15 * x)) for m in ms for dt in (-.002, .002)) * env * .028 * v
# F major: Fmaj7 – Dm7 – B♭maj7 – C(sus)
PROG = [[53, 57, 60, 64], [50, 53, 57, 60], [46, 50, 53, 57], [48, 53, 55, 60]]
mus = np.zeros(N)
def phrase(t0, t1, lvl=1.0, kal=False, arp=True):
    b = 0
    while t0 + b * BEAT < t1 - .05:
        t = t0 + b * BEAT; ch = PROG[int(t / BAR) % 4]
        if b % 4 == 0:
            add(mus, t, piano(ch[0] - 12, 3.0, lvl * .9)); add(mus, t, pad(ch, BAR + .6, lvl))
        if arp:
            for j, m in enumerate([ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12]):
                if j == b % 4: add(mus, t, piano(m, 2.0, lvl * .7))
        if kal and b % 2 == 1: add(mus, t + BEAT / 2, kalimba(ch[3] + 24, lvl))
        b += 1
a = cuts['whale'][0]; phrase(a, cuts['dino'][1], 1.0)
phrase(*cuts['length'], 1.0, kal=True)
d0, d1 = cuts['dive']; add(mus, d0, pad([41, 48, 53], d1 - d0 + .5, 1.3))   # thin, low; near-silence at the bottom
phrase(*cuts['rise'], .9, kal=True)
phrase(cuts['tongue'][0], cuts['artery'][1], 1.0, kal=True)
s0, s1 = cuts['song']; add(mus, s0, pad([53, 60, 64, 69], s1 - s0 + 1, 1.4)); phrase(s0, s1, .7, arp=True)
u0, u1 = cuts['sub']
for m in [41, 53, 57, 60, 64, 69]: add(mus, u0 + .2, piano(m, 4.5, .9))
add(mus, u0 + .2, pad([53, 57, 60, 64], u1 - u0, 1.2)); add(mus, u0 + 1.5, glock(84)); add(mus, u0 + 2.1, glock(88))
fol = np.zeros(N)
def noise(d): return rng.standard_normal(int(d * SR))
for e in EV:
    t, ty, d, v = e['t'], e['type'], e.get('d', .5), e.get('v', 1.0)
    if ty == 'brush':
        x = tt(d); add(fol, t, bp(noise(d), 1500, 6000) * (.5 + .5 * np.abs(np.sin(2 * np.pi * 2.3 * x))) * np.minimum(1, np.minimum(x, d - x) / .15) * .05)
    elif ty == 'pencil':
        x = tt(d); add(fol, t, bp(noise(d), 2500, 8000) * (.6 + .4 * np.sign(np.sin(2 * np.pi * 11 * x))) * .045)
    elif ty == 'creak': x = tt(.5); add(fol, t, bp(noise(.5), 300, 900) * np.exp(-x * 6) * .12)
    elif ty == 'beat':
        x = tt(.5)
        for k, dt in enumerate((0, .22)): add(fol, t + dt, np.sin(2 * np.pi * (45 + 30 * np.exp(-x * 20)) * x) * np.exp(-x * 9) * (.55 if k == 0 else .35) * v)
    elif ty == 'deep': x = tt(d); add(fol, t, lp(noise(d), 160) * np.minimum(1, x / 1.0) * .15)
    elif ty == 'stamp': x = tt(.4); add(fol, t, (np.sin(2 * np.pi * 70 * x) * np.exp(-x * 14) + lp(noise(.4), 1500) * np.exp(-x * 30) * .4) * .5); add(mus, t + .1, glock(81, 1.2))
    elif ty == 'song':
        x = tt(d); f = 180 + 70 * np.sin(2 * np.pi * x / 3.2) - 40 * (x % 3.2) / 3.2
        ph = 2 * np.pi * np.cumsum(f) / SR
        s = (np.sin(ph) + .4 * np.sin(2 * ph)) * (.5 + .5 * np.sin(2 * np.pi * x / 3.2 - 1.2)) ** 2 * np.minimum(1, np.minimum(x, d - x) / .6)
        add(fol, t, lp(s, 900) * .12)
    elif ty == 'waves':
        x = tt(d); add(fol, t, lp(noise(d), 700) * (.6 + .4 * np.sin(2 * np.pi * x / 4)) * np.minimum(1, x / .8) * .07)
    elif ty == 'mist': x = tt(d); add(fol, t, bp(noise(d), 400, 3000) * np.sin(np.pi * x / d) ** 2 * .05)
# soft reverb on the music
IR = rng.standard_normal(int(1.6 * SR)) * np.exp(-np.arange(int(1.6 * SR)) / SR * 3.0); IR = lp(IR, 4000); IR /= np.sqrt((IR ** 2).sum())
mus = mus * .8 + fftconvolve(mus, IR)[:N] * .35
vo = np.zeros(N); vpath = os.path.join(HERE, 'voice.wav')
if os.path.exists(vpath):
    v, vsr = sf.read(vpath, always_2d=True); v = v.mean(1)
    if vsr != SR:
        import soxr; v = soxr.resample(v, vsr, SR)
    env = np.sqrt(lp(v ** 2, 20).clip(1e-9)); v = v * np.where(env > .08, (.08 / env) ** .5, 1.0)
    add(vo, json.load(open(os.path.join(HERE, 'voice.json')))['offset'], v)
    venv = np.sqrt(lp(vo ** 2, 5).clip(0)); duck = 1 - .45 * np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
else: duck = np.ones(N)
mix = mus * duck * .9 + fol + vo * 1.9
mix = hp(mix, 30); mix = np.tanh(mix * 1.1) / 1.1; mix = mix[:int(DUR * SR)]
mix *= np.minimum(1, (DUR - np.arange(len(mix)) / SR) / 1.2)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), np.stack([mix, mix], 1) * .8, SR, subtype='PCM_24')
print('mix ok', round(len(mix) / SR, 2), 's, voice:', os.path.exists(vpath))
