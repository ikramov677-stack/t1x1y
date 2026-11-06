"""Assemble the 40-minute mix video from the Suno tracks.

Put the tracks in disco-1986/tracks/ named by number: 01.mp3, 02.mp3 … 10.mp3
(.wav / .m4a / .flac also work), then:

    python3 build_mix.py

Each track: trailing/leading silence trimmed, loudness matched to −14 LUFS
(two-pass loudnorm, linear). Tracks are joined with a crossfade, the 8-second
loop (out/loop_h.mp4) is repeated under the audio without re-encoding.

Writes out/mix.wav, out/disco-1986.mp4 and description.txt with real timestamps.
"""
import glob
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
CFG = json.load(open(os.path.join(HERE, "tracks.json"), encoding="utf-8"))


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)


def duration(path):
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])
    return float(r.stdout.strip())


def find_track(tracks_dir, n):
    for pat in (f"{n:02d}.*", f"{n}.*", f"{n:02d} *", f"{n:02d}_*", f"{n:02d}-*"):
        hits = sorted(glob.glob(os.path.join(tracks_dir, pat)))
        if hits:
            return hits[0]
    return None


TRIM = ("silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,"
        "areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.3,areverse")


def normalize(src, dst, lufs):
    """Trim silence, two-pass loudnorm (linear), 48 kHz stereo wav."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af",
                        f"{TRIM},loudnorm=I={lufs}:TP=-1.0:LRA=11:print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True, check=True)
    js = r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1]
    m = json.loads(js)
    af = (f"{TRIM},loudnorm=I={lufs}:TP=-1.0:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,"
          "aresample=48000")
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af", af, "-ac", "2", "-ar", "48000", dst])


def ts(sec):
    sec = int(round(sec))
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def main():
    tracks_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "tracks")
    xf = CFG["crossfade_s"]
    norm_dir = os.path.join(OUT, "norm")
    os.makedirs(norm_dir, exist_ok=True)

    items = []
    missing = []
    for t in CFG["tracks"]:
        src = find_track(tracks_dir, t["n"])
        if not src:
            missing.append(f'{t["n"]:02d} «{t["title"]}»')
            continue
        dst = os.path.join(norm_dir, f'{t["n"]:02d}.wav')
        print(f'normalizing {os.path.basename(src)} → {t["title"]}', flush=True)
        normalize(src, dst, CFG["lufs"])
        items.append((t, dst, duration(dst)))
    if missing:
        print("missing tracks (skipped):", ", ".join(missing))
    if len(items) < 2:
        sys.exit("need at least 2 tracks in " + tracks_dir)

    # crossfade chain
    inputs, chain = [], []
    for i, (_, p, _) in enumerate(items):
        inputs += ["-i", p]
    prev = "[0:a]"
    for i in range(1, len(items)):
        lab = f"[x{i}]"
        chain.append(f"{prev}[{i}:a]acrossfade=d={xf}:c1=tri:c2=tri{lab}")
        prev = lab
    mix = os.path.join(OUT, "mix.wav")
    run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(chain),
         "-map", prev, "-ar", "48000", mix])

    # timestamps: a track "starts" in the middle of its crossfade
    starts, t0 = [], 0.0
    for i, (_, _, d) in enumerate(items):
        starts.append(0.0 if i == 0 else t0 + xf / 2)
        t0 += d - (xf if i < len(items) - 1 else 0)
    total = duration(mix)

    # video: repeat the loop, copy video stream, AAC audio, gentle fade-out
    loop = os.path.join(OUT, "loop_h.mp4")
    if not os.path.exists(loop):
        sys.exit("render the loop first: python3 render_loop.py")
    video = os.path.join(OUT, "disco-1986.mp4")
    run(["ffmpeg", "-y", "-loglevel", "error", "-stream_loop", "-1", "-i", loop, "-i", mix,
         "-map", "0:v", "-map", "1:a", "-c:v", "copy",
         "-af", f"afade=t=in:d=1.5,afade=t=out:st={max(0, total - 4):.2f}:d=4",
         "-c:a", "aac", "-b:a", "320k", "-shortest", "-movflags", "+faststart", video])

    # description
    lines = [CFG["title"], "", "Описание:",
             "Представьте, что вы нашли старую кассету 1986 года… Эти песни никогда не звучали по радио — "
             "они созданы с помощью AI в духе советской эстрады и итало-диско. Включайте и вспоминайте 🎶", ""]
    for (t, _, _), s in zip(items, starts):
        lines.append(f'{ts(s)} {t["title"]}')
    lines += ["", "Музыка и вокал сгенерированы AI (Suno). Видео нарисовано кодом.", "",
              "#ностальгия #80е #ретро #синтпоп #aimusic"]
    with open(os.path.join(HERE, "description.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"\nmix: {ts(total)}  →  {video}")
    print("\n".join(lines[5:5 + len(items)]))


if __name__ == "__main__":
    main()
