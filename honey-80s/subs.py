"""Writes out/cues.json for srt.py from the page's subtitle pieces (exported by events.mjs is not enough, so we recompute the same rule here)."""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'timeline.js'), encoding='utf-8').read()
# read lines, voice spans and constants straight from timeline.js
texts = re.findall(r"\{ id: '(\w+)', text: '([^']*)' \}", src)
m = re.search(r"export const VOICE = (.*?);\n", src, re.S); voice = None if m.group(1).strip() == 'null' else json.loads(m.group(1))
off = float(re.search(r"VOICE_OFFSET = ([\d.]+)", src).group(1)); net = float(re.search(r"NET_FRAC = ([\d.]+)", src).group(1))
if voice is None:
    t, voice = 0.0, []
    for _, s in texts: d = len(s) / 13.5; voice.append([t, t + d]); t += d + .55
pieces = []
for (iid, s), (a, b) in zip(texts, voice):
    a += off; b += off; d = b - a
    if iid == 'spoon':
        i = s.index('нет'); pieces += [(s[:i].strip(), a - .05, a + d * net), (s[i:], a + d * net - .05, b)]
    else: pieces.append((s, a - .05, b))
cues = []
for k, (s, a, b) in enumerate(pieces):
    b = max(b + .6, a + 1.8)
    if k + 1 < len(pieces): b = min(b, pieces[k + 1][1])
    cues.append({'t0': round(max(0, a), 3), 't1': round(b, 3), 'text': s})
json.dump(cues, open(os.path.join(HERE, 'out', 'cues.json'), 'w'), ensure_ascii=False, indent=1)
print(len(cues), 'cues')
