"""Upbeat music bed + synthesized SFX for part 2. Usage: python3 audio2.py events.json out.wav [dur]"""
import json, sys, wave
import numpy as np
sr = 44100
ev = json.load(open(sys.argv[1])); out_path = sys.argv[2]; dur = float(sys.argv[3]) if len(sys.argv) > 3 else 60.0
n = int(sr * dur); t = np.arange(n) / sr
rng = np.random.default_rng(1)
def hz(m): return 440 * 2 ** ((m - 69) / 12)
bpm = 112; beat = 60 / bpm
mus = np.zeros(n)
def add(buf, start, sig):
    s = int(start * sr)
    if s >= len(buf): return
    e = min(len(buf), s + len(sig)); buf[s:e] += sig[:e - s]
prog = [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]]  # Dm Bb C A
nb = int(dur / beat) + 1
for b in range(nb):
    ch = prog[(b // 8) % 4]; st = b * beat
    tt = np.arange(int(beat * sr)) / sr
    # kick on every beat, soft
    k = np.sin(2 * np.pi * (50 + 90 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 9) * 0.35
    add(mus, st, k)
    # hat offbeat
    hl = int(0.05 * sr); h = rng.standard_normal(hl) * np.exp(-np.arange(hl) / sr * 80) * 0.06
    h = np.diff(np.concatenate([[0], h]))
    add(mus, st + beat / 2, h)
    # bass
    bt = np.arange(int(beat * 0.9 * sr)) / sr
    f = hz(ch[0] - 12)
    add(mus, st, 0.18 * np.sign(np.sin(2 * np.pi * f * bt)) * np.exp(-bt * 4) * 0.6 + 0.12 * np.sin(2 * np.pi * f * bt) * np.exp(-bt * 3))
    # marimba-ish arpeggio in 8ths
    for j in range(2):
        m = ch[[1, 2, 3, 2, 1, 3, 2, 3][(b * 2 + j) % 8]] + 12
        pt = np.arange(int(0.35 * sr)) / sr
        sig = (np.sin(2 * np.pi * hz(m) * pt) + 0.3 * np.sin(2 * np.pi * 4 * hz(m) * pt) * np.exp(-pt * 30)) * np.exp(-pt * 10) * 0.09
        add(mus, st + j * beat / 2, sig)
mus *= np.minimum(1, t / 0.5) * np.minimum(1, (dur - t) / 1.5)
mus /= np.max(np.abs(mus)) + 1e-9
sfx = np.zeros(n)
def s_pop(): x = np.arange(int(0.12 * sr)) / sr; return np.sin(2 * np.pi * (300 + 900 * x / 0.12) * x) * np.exp(-x * 35) * 0.5
def s_ding(): x = np.arange(int(0.5 * sr)) / sr; return (np.sin(2 * np.pi * 1760 * x) + 0.5 * np.sin(2 * np.pi * 2640 * x)) * np.exp(-x * 8) * 0.18
def s_tick(): x = np.arange(int(0.03 * sr)) / sr; return rng.standard_normal(len(x)) * np.exp(-x * 200) * 0.25
def s_boom():
    x = np.arange(int(0.8 * sr)) / sr
    return (np.sin(2 * np.pi * (40 + 80 * np.exp(-x * 12)) * x) * np.exp(-x * 4) + rng.standard_normal(len(x)) * np.exp(-x * 25) * 0.3) * 0.9
def s_whoosh():
    L = int(0.45 * sr); x = np.arange(L) / sr
    w = rng.standard_normal(L)
    out = np.zeros(L); a = 0.0
    for i in range(L):  # sweeping one-pole lowpass
        c = 0.02 + 0.25 * (i / L)
        a += c * (w[i] - a); out[i] = a
    return out * np.sin(np.pi * x / x[-1]) ** 2 * 1.2
SFXF = {"pop": s_pop, "ding": s_ding, "tick": s_tick, "boom": s_boom, "whoosh": s_whoosh}
for tm, kind in ev:
    if tm < dur: add(sfx, tm, SFXF[kind]())
mix = 0.20 * mus + 0.55 * sfx
mix /= max(1.0, np.max(np.abs(mix)) / 0.95)
with wave.open(out_path, "w") as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr); f.writeframes((mix * 32767).astype(np.int16).tobytes())
