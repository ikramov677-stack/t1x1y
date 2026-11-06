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
# storm scenes: low pad + sparse piano; science plates: the gentle phrase; ending: full cadence
for name in ('bolt', 'thunder', 'count', 'tower'):
    a0, a1 = cuts[name]; add(mus, a0, pad([38, 45, 50, 53], a1 - a0 + .6, 1.2))
for name in ('sun', 'compare', 'five', 'map', 'earth', 'sand'):
    phrase(*cuts[name], .9, kal=name in ('five', 'earth'))
u0, u1 = cuts['sub']
for m in [41, 53, 57, 60, 64, 69]: add(mus, u0 + .2, piano(m, 4.5, .9))
add(mus, u0 + .2, pad([53, 57, 60, 64], u1 - u0, 1.2)); add(mus, u0 + 1.0, glock(84)); add(mus, u0 + 1.6, glock(88))
phrase(u0 + 1.2, u1 - .8, .6, kal=True)
fol = np.zeros(N)
def noise(d): return rng.standard_normal(int(d * SR))
def thunder(d, v):
    x = tt(d); r = lp(noise(d), 120) * 2.5 + lp(noise(d), 400) * .6 * np.exp(-x * 1.5)
    env = np.minimum(1, x / .25) * np.exp(-x * 1.1) * (1 + .5 * np.sin(2 * np.pi * 1.3 * x) * np.exp(-x))
    return r * env * .4 * v
for e in EV:
    t, ty, d, v = e['t'], e['type'], e.get('d', .5), e.get('v', 1.0)
    if ty == 'brush':
        x = tt(d); add(fol, t, bp(noise(d), 1500, 6000) * (.5 + .5 * np.abs(np.sin(2 * np.pi * 2.3 * x))) * np.minimum(1, np.minimum(x, d - x) / .15) * .05)
    elif ty == 'pencil':
        x = tt(d); add(fol, t, bp(noise(d), 2500, 8000) * (.6 + .4 * np.sign(np.sin(2 * np.pi * 11 * x))) * .045)
    elif ty == 'rain':
        x = tt(d); add(fol, t, (hp(noise(d), 3000) * .05 + bp(noise(d), 600, 2500) * .03) * np.minimum(1, np.minimum(x, d - x) / .4) * v)
    elif ty == 'crack':
        x = tt(.6); add(fol, t, (hp(noise(.6), 1500) * np.exp(-x * 14) * .3 + lp(noise(.6), 300) * np.exp(-x * 5) * .35) * v)
    elif ty == 'thunder': add(fol, t, thunder(d, v))
    elif ty == 'tick':
        for k in range(int(d / .1)): x = tt(.03); add(fol, t + k * .1, hp(noise(.03), 3000) * np.exp(-x * 250) * .12)
    elif ty == 'pop': add(mus, t, glock(76 + 4 * int(t * 7 % 3), .8))
    elif ty == 'count': x = tt(.08); add(fol, t, bp(noise(.08), 1500, 4000) * np.exp(-x * 60) * .3); add(mus, t, kalimba(72, .8))
    elif ty == 'sparkle':
        for k in range(int(d * 6)): add(mus, t + k / 6, glock(84 + (k * 5) % 12, .35))
    elif ty == 'wind': x = tt(d); add(fol, t, bp(noise(d), 300, 1200) * (.6 + .4 * np.sin(2 * np.pi * .4 * x)) * np.minimum(1, np.minimum(x, d - x) / .5) * .06)
    elif ty == 'birds':
        for k in range(int(d * 1.5)):
            x = tt(.25); f = 2600 + 900 * np.sin(2 * np.pi * 18 * x)
            add(fol, t + .4 + k / 1.5 + (k % 3) * .11, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * x / .25) ** 2 * .03)
    elif ty == 'chime':
        for k, f in enumerate([1568, 1976, 2349]): x = tt(1.2); add(fol, t + k * .09, np.sin(2 * np.pi * f * x) * np.exp(-x * 4) * .07)
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
mix = hp(mix, 30)
from scipy.ndimage import maximum_filter1d
rms = np.sqrt(lp(mix ** 2, 3).clip(1e-12)).mean() * 3.5           # limiter: peaks above ~3.5× average RMS are pulled down
pk = maximum_filter1d(np.abs(mix), int(.01 * SR)); g = np.minimum(1, rms / (pk + 1e-9)); g = lp(g, 40).clip(.05, 1)
mix = mix * g; mix = np.tanh(mix * 1.1) / 1.1; mix = mix[:int(DUR * SR)]
mix *= np.minimum(1, (DUR - np.arange(len(mix)) / SR) / 1.2)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), np.stack([mix, mix], 1) * .8, SR, subtype='PCM_24')
print('mix ok', round(len(mix) / SR, 2), 's, voice:', os.path.exists(vpath))
