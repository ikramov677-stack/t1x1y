"""Score + foley + (optional) voice → out/mix.wav. Reads events.json (export: node core/render/events.mjs <film>).
City-pop score synthesized in numpy, written to the cut: 100 BPM, D♭ major, final chorus a semitone up."""
import json, os, sys
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
E = json.load(open(os.path.join(HERE, 'events.json')))
DUR = E['dur']; EV = E['ev']
N = int((DUR + 1) * SR)
rng = np.random.default_rng(7)
BPM = 100; BEAT = 60 / BPM; BAR = BEAT * 4
cuts = {e['name']: e for e in EV if e['type'] == 'cut'}
t_net = next(e['t'] for e in EV if e['type'] == 'net')
t_lid = next(e['t'] for e in EV if e['type'] == 'lid')
def sec(name): c = cuts[name]; return c['t'], c['t'] + c['d']

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

# ——— instruments
def epiano(m, d, v=1.0):   # FM e-piano: 1:1 carrier + 14:1 bell transient
    x = tt(d + .6); f = hz(m)
    env = np.exp(-x * 2.2) * np.minimum(1, x / .004)
    mod = np.sin(2 * np.pi * f * x) * 1.6 * np.exp(-x * 5)
    bell = np.sin(2 * np.pi * f * 14 * x) * .35 * np.exp(-x * 30)
    return (np.sin(2 * np.pi * f * x + mod) + bell) * env * .22 * v
def slap(m, d, v=1.0, pop=False):
    x = tt(d); f = hz(m + (12 if pop else 0))
    env = np.exp(-x * (9 if pop else 5)) * np.minimum(1, x / .002)
    s = np.sin(2 * np.pi * f * x) + .45 * np.sin(4 * np.pi * f * x) + .2 * np.sin(6 * np.pi * f * x)
    att = bp(rng.standard_normal(len(x)), 800, 3000) * np.exp(-x * 80) * .3
    return (np.tanh(s * 1.6) * .5 + att) * env * .35 * v
def kick(v=1.0):
    x = tt(.4); return np.sin(2 * np.pi * (48 + 110 * np.exp(-x * 28)) * x) * np.exp(-x * 7) * .7 * v
def snare(v=1.0):   # gated-reverb snare
    x = tt(.32); n = bp(rng.standard_normal(len(x)), 900, 7000)
    gate = np.where(x < .24, 1.0, np.exp(-(x - .24) * 60))
    return (n * .5 * np.exp(-x * 3) * gate + np.sin(2 * np.pi * 190 * x) * np.exp(-x * 25) * .5) * .45 * v
def hat(v=1.0):
    x = tt(.06); return hp(rng.standard_normal(len(x)), 7000) * np.exp(-x * 70) * .18 * v
def chank(ms, v=1.0):   # muted 16th guitar chord, chorus-y
    x = tt(.09); s = sum(np.sign(np.sin(2 * np.pi * hz(m) * x * (1 + .003 * np.sin(2 * np.pi * 5 * x)))) for m in ms)
    return bp(s, 600, 4000) * np.exp(-x * 40) * .05 * v
def brass(ms, d=.45, v=1.0):
    x = tt(d); env = np.minimum(1, x / .02) * np.exp(-x * 3)
    s = sum(sum(np.sin(2 * np.pi * hz(m) * k * x) / k for k in range(1, 7)) for m in ms)
    return lp(s, 2500) * env * .09 * v
def pad(ms, d, v=1.0):
    x = tt(d); env = np.minimum(1, x / .6) * np.minimum(1, (d - x) / .6)
    s = sum(np.sin(2 * np.pi * hz(m) * x * (1 + dt)) for m in ms for dt in (-.003, .003))
    return s * env * .035 * v
def bellsp(m, v=1.0):
    x = tt(1.2); return np.sin(2 * np.pi * hz(m) * x + 2 * np.sin(2 * np.pi * hz(m) * 3.5 * x) * np.exp(-x * 6)) * np.exp(-x * 4) * .12 * v
def lead(m, d, v=1.0):   # sax-like synth lead
    x = tt(d); f = hz(m) * (1 + .006 * np.sin(2 * np.pi * 5.5 * x) * np.minimum(1, x / .3))
    ph = 2 * np.cumsum(f) / SR * np.pi
    s = np.tanh(2.5 * (np.sin(ph) + .5 * np.sin(2 * ph) + .3 * np.sin(3 * ph)))
    return lp(s, 3200) * np.minimum(1, x / .03) * np.minimum(1, (d - x) / .08) * .1 * v

# D♭ major: D♭maj7 – B♭m9 – G♭maj7 – A♭7sus (MIDI roots 49, 46, 42, 44)
PROG = [(49, [61, 65, 68, 72]), (46, [61, 65, 68, 70]), (42, [61, 65, 66, 70]), (44, [61, 63, 66, 68])]
mus = np.zeros(N); drums = np.zeros(N)

def groove(t0, t1, level=1.0, drums_on=True, chanks=True, up=0, lead_on=False):
    nb = int(np.ceil((t1 - t0) / BEAT))
    for b in range(nb):
        t = t0 + b * BEAT
        if t >= t1 - 1e-6: break
        root, ch = PROG[int((t - 0) / BAR) % 4]
        root += up; ch = [m + up for m in ch]
        if b % 4 == 0 or (b % 4 == 2 and level > .8):
            for m in ch: add(mus, t, epiano(m, BEAT * 2, level))
        add(mus, t, slap(root - 12, BEAT * .45, level))
        if b % 2 == 1: add(mus, t + BEAT * .5, slap(root - 12, BEAT * .3, level * .9, pop=True))
        if drums_on:
            if b % 2 == 0: add(drums, t, kick(level))
            else: add(drums, t, snare(level))
            for k in range(2): add(drums, t + k * BEAT / 2, hat(level * (1 if k else .6)))
        if chanks:
            for k in (1, 3): add(mus, t + k * BEAT / 4, chank(ch[:3], level))
        if lead_on and b % 2 == 0:
            mel = [72, 75, 77, 75, 73, 72, 70, 72]
            add(mus, t, lead(mel[(b // 2) % 8] + up, BEAT * 1.8, level))

# intro: hook
a, b = sec('jar'); 
for m in PROG[0][1]: add(mus, a, epiano(m, 2.5))
add(mus, a + .45, brass([61, 65, 68, 72], .6, 1.2)); add(mus, a + 1.2, bellsp(85))
groove(a + BEAT * 2, b, .7, drums_on=False, chanks=False)
# tomb: pad, no drums, then one beat of true silence before the lid
a, b = sec('tomb'); add(mus, a, pad([42, 49, 54, 58], (t_lid - a) - BEAT, 1.2))
add(mus, t_lid, brass([61, 65, 68, 72, 77], .9, 1.3)); add(mus, t_lid, bellsp(89)); add(mus, t_lid + .2, bellsp(84))
for m in PROG[0][1]: add(mus, t_lid, epiano(m, 2.0))
a, b = sec('open'); add(mus, t_lid + BEAT * 2, pad([49, 56, 61, 65], b - t_lid - BEAT * 2, .8))
# science groove
a = sec('water')[0]; b = t_net
groove(a, b, 1.0)
# tape stop on the self-correction: pitch the last 0.4 s down, then silence for half a beat, then fill
seg_ = mus[int((t_net - .4) * SR):int(t_net * SR)].copy(); dseg = drums[int((t_net - .4) * SR):int(t_net * SR)].copy()
L = len(seg_); idx = np.cumsum(np.linspace(1, .15, L)); idx = (idx / idx[-1] * (L - 1)).astype(int)
mus[int((t_net - .4) * SR):int(t_net * SR)] = seg_[idx] * np.linspace(1, .2, L)
drums[int((t_net - .4) * SR):int(t_net * SR)] = 0
restart = t_net + BEAT * 1.5
mus[int(t_net * SR):int(restart * SR)] = 0; drums[int(t_net * SR):int(restart * SR)] = 0
for k in range(4): add(drums, restart - BEAT + k * BEAT / 4, snare(.6 + .1 * k))
groove(restart, sec('spoon')[1], 1.0)
# morning kitchen: softer
a, b = sec('cryst'); groove(a, b, .65, drums_on=False, chanks=False)
add(mus, a + 1.4, bellsp(89))
# garden: final chorus a semitone up, lead, held last chord
a, b = sec('sub'); end = DUR - 1.2
groove(a, end, 1.15, up=1, lead_on=True)
add(mus, a + .8, brass([62, 66, 69, 73], .7, 1.3))
for m in [62, 66, 69, 73, 76]: add(mus, end, epiano(m, 2.5, 1.1))
add(mus, end, pad([50, 57, 62, 66], 2.0, 1.2))

# ——— foley
fol = np.zeros(N)
def noise(d): return rng.standard_normal(int(d * SR))
for e in EV:
    t, ty, d, v = e['t'], e['type'], e.get('d', .3), e.get('v', 1.0)
    if ty == 'crton':
        x = tt(.5); add(fol, t, (np.sin(2 * np.pi * 15734 / 4 * x) * .05 + lp(noise(.5), 300) * .3 * np.exp(-x * 12)) * np.exp(-x * 4))
    elif ty == 'glint': x = tt(.6); add(fol, t, np.sin(2 * np.pi * 2800 * x) * np.exp(-x * 7) * .1)
    elif ty == 'wind': x = tt(d); add(fol, t, bp(noise(d), 200, 900) * (0.5 + .5 * np.sin(2 * np.pi * .3 * x)) * np.minimum(1, np.minimum(x, d - x) / .5) * .08)
    elif ty == 'scrape': x = tt(.5); add(fol, t, bp(noise(.5), 400, 2000) * np.exp(-x * 5) * .25 + np.sin(2 * np.pi * 90 * x) * np.exp(-x * 9) * .3)
    elif ty == 'shimmer':
        x = tt(d)
        for k, f in enumerate([1760, 2217, 2637, 3520]): add(fol, t + k * .06, np.sin(2 * np.pi * f * x) * np.exp(-x * 2.5) * .04)
    elif ty == 'pop': x = tt(.12); add(fol, t, np.sin(2 * np.pi * (300 + 900 * x / .12) * x) * np.exp(-x * 35) * .3)
    elif ty == 'pen': x = tt(d); add(fol, t, bp(noise(d), 2000, 6000) * (0.6 + .4 * np.sign(np.sin(2 * np.pi * 9 * x))) * .07)
    elif ty == 'step': x = tt(.06); add(fol, t, lp(noise(.06), 1500) * np.exp(-x * 60) * .25 * v)
    elif ty == 'tick':
        for k in range(int(d / .08)): x = tt(.02); add(fol, t + k * .08, hp(noise(.02), 3000) * np.exp(-x * 300) * .15)
    elif ty == 'buzz':
        x = tt(d); f = 220 * (1 + .03 * np.sin(2 * np.pi * 3 * x))
        s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * (0.6 + .4 * np.sin(2 * np.pi * 17 * x))
        add(fol, t, lp(s, 1800) * np.minimum(1, np.minimum(x, d - x) / .2) * .035 * v)
    elif ty == 'drip': x = tt(.15); add(fol, t, np.sin(2 * np.pi * (500 + 1500 * x / .15) * x) * np.exp(-x * 30) * .2)
    elif ty == 'whoosh': x = tt(.5); add(fol, t, bp(noise(.5), 300, 3000) * np.sin(np.pi * x / .5) ** 2 * .25)
    elif ty == 'impact': x = tt(.6); add(fol, t, (np.sin(2 * np.pi * (45 + 90 * np.exp(-x * 15)) * x) * np.exp(-x * 5) + lp(noise(.6), 2000) * np.exp(-x * 20) * .5) * .6)
    elif ty == 'boing': x = tt(.5); add(fol, t, np.sin(2 * np.pi * (200 + 120 * np.sin(2 * np.pi * 7 * x)) * x) * np.exp(-x * 6) * .2)
    elif ty == 'tapestop': x = tt(.4); add(fol, t, np.sin(2 * np.pi * np.cumsum(np.linspace(300, 40, len(x))) / SR) * np.exp(-x * 3) * .12)
    elif ty == 'tracking': x = tt(d); add(fol, t, (hp(noise(d), 2000) * .12 + np.sin(2 * np.pi * 15734 / 3 * x) * .03) * np.minimum(1, (d - x) / .05))
    elif ty == 'chime':
        for k, f in enumerate([1568, 1976, 2349]): x = tt(1.2); add(fol, t + k * .09, np.sin(2 * np.pi * f * x) * np.exp(-x * 4) * .08)
    elif ty == 'brass': pass

# ——— voice (optional)
vo = np.zeros(N)
vpath = os.path.join(HERE, 'voice.wav')
if os.path.exists(vpath):
    v, vsr = sf.read(vpath, always_2d=True); v = v.mean(1)
    if vsr != SR:
        import soxr; v = soxr.resample(v, vsr, SR)
    off = json.load(open(os.path.join(HERE, 'voice.json')))['offset']
    # gentle compression
    env = np.sqrt(lp(v ** 2, 20).clip(1e-9)); g = np.where(env > .08, (.08 / env) ** .5, 1.0); v = v * g
    add(vo, off, v)
    # duck music under speech (~9 dB)
    venv = np.sqrt(lp(vo ** 2, 6).clip(0)); duck = 1 - .65 * np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
else:
    duck = np.ones(N)

music = (mus + drums * .8) * duck
mix = music * .55 + fol * .9 + vo * (1.9 if vo.any() else 0)
mix = hp(mix, 30)
mix = np.tanh(mix * 1.2) / 1.2
mix = mix[:int(DUR * SR)]
fade = np.minimum(1, (DUR - np.arange(len(mix)) / SR) / 1.0); mix *= fade
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), np.stack([mix, mix], 1) * .8, SR, subtype='PCM_24')
print('mix ok', round(len(mix) / SR, 2), 's, voice:', os.path.exists(vpath))
