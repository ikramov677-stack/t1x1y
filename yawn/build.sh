#!/bin/sh
# One command: events → video (30 fps, 1080×1920) → score/foley/voice mix → master (−14 LUFS) → .srt
set -e
LIB=${LIB:-/root/lemo-opuscar}
HERE=$(cd "$(dirname "$0")" && pwd)
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the Lemo-Opuscar library folder"; exit 1; }
cd "$LIB"
node core/render/events.mjs "$HERE" --size 1080x1920
node core/render/video.mjs "$HERE" --fps 30 --workers 4 --size 1080x1920 --out "$HERE/out/video.mp4"
"$LIB/.venv/bin/python" "$HERE/mix.py"
"$LIB/.venv/bin/python" -c "import json,sys; e=json.load(open(sys.argv[1])); json.dump([{'t0':x['t'],'t1':x['t1'],'text':x['text']} for x in e['ev'] if x['type']=='sub'], open(sys.argv[2],'w'), ensure_ascii=False)" "$HERE/events.json" "$HERE/out/cues.json"
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/yawn.mp4" 30 0
"$LIB/.venv/bin/python" core/render/srt.py "$HERE/out/cues.json" "$HERE/yawn.srt"
