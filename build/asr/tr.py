import sherpa_onnx, soundfile as sf, numpy as np, subprocess, re, sys
m='sherpa-onnx-whisper-small/'
rec=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=m+'small-encoder.int8.onnx',decoder=m+'small-decoder.int8.onnx',tokens=m+'small-tokens.txt',language='ru',task='transcribe',num_threads=4)
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',sys.argv[1] if len(sys.argv)>1 else '../audio/el.mp3','-ar','16000','-ac','1','el16.wav'])
a,sr=sf.read('el16.wav',dtype='float32')
log=subprocess.run(['ffmpeg','-i','el16.wav','-af','silencedetect=noise=-35dB:d=0.2','-f','null','-'],capture_output=True,text=True).stderr
st=[float(x) for x in re.findall(r'silence_start: ([\d.]+)',log)]; en=[float(x) for x in re.findall(r'silence_end: ([\d.]+)',log)]
segs=[]; cur=en[0]
for s,e in zip(st[1:],en[1:]+[len(a)/sr]):
    segs.append((cur,s)); cur=e
if cur<len(a)/sr-0.1: segs.append((cur,len(a)/sr))
for s,e in segs:
    x=a[int(max(0,s-0.1)*sr):int((e+0.1)*sr)]
    st_=rec.create_stream(); st_.accept_waveform(sr,x); rec.decode_stream(st_)
    print(f"{s:6.2f} {e:6.2f} | {st_.result.text.strip()}",flush=True)
