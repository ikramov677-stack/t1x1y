#!/bin/sh
# Resumable build: render in chunks (rerun this script if it is stopped), then mix, master and subtitles.
set -e
LIB=${LIB:-/root/lemo-opuscar}
HERE=$(cd "$(dirname "$0")" && pwd)
cd "$LIB"
node core/render/events.mjs "$HERE" --size 1080x1920
node "$HERE/chunks.mjs" "$HERE" "$HERE/out/chunks" --fps 30 --workers 4 --size 1080x1920 --chunk 60
(cd "$HERE/out/chunks" && ffmpeg -y -loglevel error -f concat -safe 0 -i list.txt -c copy ../video.mp4)
"$LIB/.venv/bin/python" "$HERE/mix.py"
"$LIB/.venv/bin/python" -c "import json,sys; e=json.load(open(sys.argv[1])); json.dump([{'t0':x['t'],'t1':x['t1'],'text':x['text']} for x in e['ev'] if x['type']=='sub'], open(sys.argv[2],'w'), ensure_ascii=False)" "$HERE/events.json" "$HERE/out/cues.json"
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/earthstop.mp4" 30 0
"$LIB/.venv/bin/python" core/render/srt.py "$HERE/out/cues.json" "$HERE/earthstop.srt"
