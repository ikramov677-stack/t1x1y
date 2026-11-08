#!/bin/sh
# One command: events → video (30 fps, 1920×1080) → score/foley/voice mix → master (−14 LUFS) → .srt
# Needs: node + Playwright (Chromium), ffmpeg, python3 with numpy/scipy/soundfile (soxr only if voice.wav isn't 48 kHz).
# Narration: drop the recorded voice as voice.mp3 (or voice.wav) here, set the start offset in voice.json, fill VOICE in main.js, run again.
set -e
HERE=$(cd "$(dirname "$0")" && pwd); cd "$HERE"
[ -f voice.mp3 ] && [ ! -f voice.wav ] && ffmpeg -y -loglevel error -i voice.mp3 -ar 48000 -ac 1 voice.wav
node render.mjs events
node render.mjs video --fps 30 --workers ${WORKERS:-4}
python3 mix.py
python3 master.py out/video.mp4 out/mix.wav croshka.mp4
python3 -c "
import json
e = json.load(open('events.json'))['ev']
def ts(s): h, r = divmod(s, 3600); m, r = divmod(r, 60); return '%02d:%02d:%02d,%03d' % (h, m, int(r), round((r - int(r)) * 1000) % 1000)
subs = [x for x in e if x['type'] == 'sub']
open('croshka.srt', 'w').write('\n'.join('%d\n%s --> %s\n%s\n' % (i + 1, ts(x['t']), ts(x['t1']), x['text']) for i, x in enumerate(subs)))
print('srt', len(subs))"
