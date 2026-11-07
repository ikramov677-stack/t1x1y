"""Romantic score (felt piano arpeggios, warm strings pad, music box at the meeting) + foley + optional voice → out/mix.wav."""
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
def add(buf, at, sig, g=1.0):
    i = int(at * SR)
    if i < 0: sig = sig[-i:]; i = 0
    j = min(len(buf), i + len(sig))
    if j > i: buf[i:j] += sig[:j - i] * g
def fade(x, d, a=1.5, r=1.5): return np.minimum(1, x / a) * np.minimum(1, np.maximum(0, d - x) / r)
def strings(ms, d, v=1.0, bright=1600):
    x = tt(d); s = 0
    for m in ms:
        for det in (-.004, 0, .004):
            ph = 2 * np.pi * hz(m) * (1 + det) * x + .02 * np.sin(2 * np.pi * 5.2 * x)
            s = s + np.sin(ph) + .25 * np.sin(2 * ph) + .12 * np.sin(3 * ph)
    return lp(s, bright) * fade(x, d, 1.8, 1.8) * .018 * v
def piano(m, d=3.0, v=1.0):
    x = tt(d); f = hz(m); s = 0
    for k, a in ((1, 1), (2, .45), (3, .2), (4, .08), (5, .04)): s = s + a * np.sin(2 * np.pi * f * k * (1 + .0004 * k * k) * x) * np.exp(-x * (.9 + k * .8))
    return lp(s * np.minimum(1, x / .006), 3000) * .11 * v
def mbox(m, v=1.0):
    x = tt(2.0); f = hz(m); s = np.sin(2 * np.pi * f * x) + .4 * np.sin(2 * np.pi * f * 4.1 * x) * np.exp(-x * 6) + .2 * np.sin(2 * np.pi * f * 2.76 * x) * np.exp(-x * 4)
    return s * np.exp(-x * 2.2) * np.minimum(1, x / .002) * .05 * v
mus = np.zeros(N)
# A minor → C major colours: Am – F – C – G (G → E7 before the meeting)
PROG = [[45, 57, 60, 64], [41, 57, 60, 65], [48, 55, 60, 64], [43, 55, 59, 62]]
t_mid = cuts['mid'][0]; t_tog = cuts['together'][0]
t = 0.0; k = 0
while t < DUR:
    ch = PROG[k % 4]; d = BAR
    lvl = .55 + .7 * (t / DUR) ** 1.3
    add(mus, t, strings(ch[1:], d + 1.6, lvl, 1200 + 1600 * t / DUR)); add(mus, t, strings([ch[0]], d + 1.6, lvl * 1.2, 500))
    arp = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12, ch[1] + 24, ch[3] + 12, ch[2] + 12, ch[3] + 12]
    for j, m in enumerate(arp):
        if t < cuts['map'][0] and j % 2: continue
        add(mus, t + j * BEAT / 2, piano(m, 3.0, .7 + .3 * (j == 0)))
    add(mus, t, piano(ch[0] + 12, 4.0, .8))
    if t >= t_tog - .1:
        mel = [76, 74, 72, 71, 72, 76, 79, 76]
        for j in range(4): add(mus, t + j * BEAT, mbox(mel[(k * 4 + j) % 8] + 12, .9))
    t += d; k += 1
fol = np.zeros(N)
def crackle(d, v):
    out = lp(noise(d), 900) * .02
    for i in range(int(d * 14)):
        at = rng.random() * d; x = tt(.02); c = hp(noise(.02), 2500) * np.exp(-x * 300) * (.05 + .1 * rng.random())
        j = int(at * SR); out[j:j + len(c)] += c[:max(0, len(out) - j)]
    return out * v * fade(tt(d), d, .5, .5)
def rainS(d, v, lpf=None):
    x = tt(d); r = bp(noise(d), 800, 7000) * .045 + lp(noise(d), 400) * .03
    for i in range(int(d * 40)):
        at = rng.random() * d; y = tt(.01); c = bp(noise(.01), 2000, 8000) * np.exp(-y * 500) * .05 * rng.random()
        j = int(at * SR); r[j:j + len(c)] += c[:max(0, len(r) - j)]
    if lpf: r = lp(r, 1400) * 1.4
    return r * v * fade(x, d, .6, .6)
for e in EV:
    t, ty, d, v = e['t'], e['type'], e.get('d', .5), e.get('v', 1.0)
    if ty == 'crackle': add(fol, t, crackle(d, v))
    elif ty == 'rain': add(fol, t, rainS(d, v, e.get('lp')))
    elif ty == 'whoosh': x = tt(d); add(fol, t, bp(noise(d), 200, 2500) * np.sin(np.pi * x / d) ** 2 * .06)
    elif ty == 'chime':
        for j, m in enumerate([84, 88, 91, 96]): add(fol, t + j * .09, mbox(m, 1.6))
    elif ty == 'ping': m = 88 if e.get('hi') else 83; add(fol, t, mbox(m, 2.2 * v)); add(fol, t + .12, mbox(m + 7, 1.6 * v))
    elif ty == 'wind': x = tt(d); add(fol, t, bp(noise(d), 150, 900) * (.6 + .4 * np.sin(2 * np.pi * .25 * x)) * fade(x, d, .6, .6) * .09)
    elif ty == 'hiss': x = tt(d); add(fol, t, hp(noise(d), 3000) * (.5 + .5 * np.sin(2 * np.pi * .7 * x) ** 2) * fade(x, d, .5, .6) * .03 * v)
    elif ty == 'dusk':
        x = tt(d); add(fol, t, lp(noise(d), 500) * fade(x, d, 1, 1) * .025)
        for i in range(int(d * 1.5)): y = tt(.22); add(fol, t + .4 + i / 1.5 + (i % 3) * .1, np.sin(2 * np.pi * 4200 * y) * (np.sin(2 * np.pi * 28 * y) > 0) * np.sin(np.pi * y / .22) * .012)
    elif ty == 'step': x = tt(.12); f = 90 if e.get('lo') else 160; add(fol, t, (np.sin(2 * np.pi * f * x) * np.exp(-x * 40) + lp(noise(.12), 1200) * np.exp(-x * 50) * .4) * .18 * v)
    elif ty == 'swell': x = tt(d); add(mus, t, strings([69, 72, 76, 81], d, 1.4, 2400) * np.minimum(1, x / 3))
IR = noise(3.0) * np.exp(-np.arange(int(3.0 * SR)) / SR * 1.8); IR = lp(IR, 5000); IR /= np.sqrt((IR ** 2).sum())
music = mus * .75 + fftconvolve(mus, IR)[:N] * .5
fol = fol + fftconvolve(fol, IR)[:N] * .15
vo = np.zeros(N); vpath = os.path.join(HERE, 'voice.wav')
if os.path.exists(vpath):
    v, vsr = sf.read(vpath, always_2d=True); v = v.mean(1)
    if vsr != SR:
        import soxr; v = soxr.resample(v, vsr, SR)
    env = np.sqrt(lp(v ** 2, 20).clip(1e-9)); v = v * np.where(env > .08, (.08 / env) ** .5, 1.0)
    add(vo, json.load(open(os.path.join(HERE, 'voice.json')))['offset'], v)
    venv = np.sqrt(lp(vo ** 2, 5).clip(0)); duck = 1 - .5 * np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
else: duck = np.ones(N)
mix = music * duck + fol * duck ** .5 + vo * 1.9
mix = hp(mix, 28)
rms = np.sqrt(lp(mix ** 2, 3).clip(1e-12)).mean() * 3.5
pk = maximum_filter1d(np.abs(mix), int(.01 * SR)); g = lp(np.minimum(1, rms / (pk + 1e-9)), 40).clip(.05, 1); mix = mix * g
mix = np.tanh(mix * 1.1) / 1.1; mix = mix[:int(DUR * SR)]; mix *= np.minimum(1, (DUR - np.arange(len(mix)) / SR) / 1.5)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), np.stack([mix, mix], 1) * .8, SR, subtype='PCM_24')
print('mix ok', round(len(mix) / SR, 2), 's, voice:', os.path.exists(vpath))
