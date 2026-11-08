"""Mux picture + mix: two-pass loudnorm to −14 LUFS / −1.5 dBTP, AAC 256k. master.py video.mp4 mix.wav out.mp4"""
import json, subprocess, sys
V, A, O = sys.argv[1:4]
r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', A, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
j = json.loads(r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1])
ln = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
      f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample=192000,alimiter=limit=0.84:level=disabled:latency=1,aresample=48000")
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', V, '-i', A, '-filter_complex', f'[1:a]{ln}[a]', '-map', '0:v', '-map', '[a]',
                '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', O], check=True)
m = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', O, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
print(O); print('\n'.join(l.strip() for l in m.splitlines()[-12:] if l.strip().startswith(('I:', 'Peak:', 'LRA:'))))
