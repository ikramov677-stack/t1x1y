import numpy as np, wave
sr=44100; dur=60.0; n=int(sr*dur); t=np.arange(n)/sr
out=np.zeros(n)
def note(f): return 440*2**((f-69)/12)
chords=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]]  # Am F C G
step=2.5
for ci in range(int(dur/step)+1):
    ch=chords[ci%4]; s=int(ci*step*sr); e=min(n,int((ci*step+step+0.6)*sr))
    if s>=n: break
    tt=np.arange(e-s)/sr; env=np.minimum(1,tt/0.6)*np.exp(-np.maximum(0,tt-step)/0.3)
    for m in ch:
        f=note(m); out[s:e]+=0.05*env*(np.sin(2*np.pi*f*tt)+0.3*np.sin(2*np.pi*2*f*tt+0.5))
    # pluck arpeggio
    for k,m in enumerate([ch[0]+12,ch[1]+12,ch[2]+12,ch[1]+12,ch[0]+24]):
        ps=s+int(k*step/5*sr); pe=min(n,ps+int(0.6*sr))
        if ps>=n: break
        pt=np.arange(pe-ps)/sr
        out[ps:pe]+=0.04*np.exp(-pt*6)*np.sin(2*np.pi*note(m)*pt)
out*=np.minimum(1,t/1.0)*np.minimum(1,(dur-t)/1.5)
out=out/np.max(np.abs(out))*0.9
d=(out*32767).astype(np.int16)
with wave.open('audio/music.wav','w') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(d.tobytes())
