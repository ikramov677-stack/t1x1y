"""Calm music bed (soft pad + music-box arpeggio) with chimes. Usage: python3 audio4.py events.json out.wav"""
import json, sys, wave
import numpy as np
sr = 44100
cfg = json.load(open(sys.argv[1])); dur = cfg["dur"]; ev = cfg["events"]
n = int(sr * dur); t = np.arange(n) / sr
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def add(buf, st, sig):
    s = int(st * sr)
    if s >= len(buf): return
    e = min(len(buf), s + len(sig)); buf[s:e] += sig[:e - s]
out = np.zeros(n)
prog = [[53, 57, 60, 64], [50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 60]]  # Fmaj7 Dm7 Bbmaj7 C
bar = 60 / 68 * 4
for b in range(int(dur / bar) + 2):
    ch = prog[b % 4]; st = b * bar
    L = int((bar + 1.5) * sr); tt = np.arange(L) / sr
    env = np.minimum(1, tt / 1.2) * np.exp(-np.maximum(0, tt - bar) / 0.8)
    pad = sum(np.sin(2 * np.pi * hz(m) * tt + 0.3 * np.sin(2 * np.pi * 0.2 * tt)) for m in ch[:3]) / 3
    add(out, st, 0.22 * env * pad)
    add(out, st, 0.18 * np.sin(2 * np.pi * hz(ch[0] - 12) * tt) * env)
    for j, m in enumerate([ch[0] + 12, ch[2] + 12, ch[3] + 12, ch[1] + 24, ch[3] + 12, ch[2] + 12]):
        pt = np.arange(int(1.2 * sr)) / sr
        sig = (np.sin(2 * np.pi * hz(m) * pt) + 0.25 * np.sin(2 * np.pi * 3 * hz(m) * pt)) * np.exp(-pt * 3.5) * 0.10
        add(out, st + j * bar / 6, sig)
for tm, kind in ev:
    pt = np.arange(int(2.0 * sr)) / sr
    sig = sum(np.sin(2 * np.pi * f * pt) * a for f, a in ((1568, 1), (2093, 0.6), (3136, 0.25))) * np.exp(-pt * 2.5) * 0.12
    add(out, tm, sig)
out *= np.minimum(1, t / 1.0) * np.minimum(1, (dur - t) / 2.0)
out /= np.max(np.abs(out)) / 0.9
with wave.open(sys.argv[2], "w") as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr); f.writeframes((out * 32767).astype(np.int16).tobytes())
