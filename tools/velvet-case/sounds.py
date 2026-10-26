"""Original deterministic period-styled music and mechanical foley, no borrowed recordings."""
import numpy as np, wave, os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));SR=44100;rng=np.random.default_rng(1976)
def write(name,a):
 a=np.tanh(a)*.72
 # Short fades prevent endpoint clicks.
 n=min(600,len(a)//4);a[:n]*=np.linspace(0,1,n);a[-n:]*=np.linspace(1,0,n)
 with wave.open(ROOT+'/public/audio/velvet-case/'+name+'.wav','wb') as w:w.setparams((1,2,SR,0,'NONE','not compressed'));w.writeframes((np.clip(a,-1,1)*32767).astype('<i2').tobytes())
def tone(a,start,freq,duration,gain=.2):
 t=np.arange(int(SR*duration))/SR;v=(np.sin(2*np.pi*freq*t+.004*np.sin(t*29))+ .3*np.sin(2*np.pi*freq*2.003*t))*np.exp(-t*4)*np.minimum(1,t/.007)*gain;i=int(start*SR);n=min(len(v),len(a)-i);a[i:i+n]+=v[:n]
def knock(a,start,gain,freq=110,dur=.18):
 t=np.arange(int(SR*dur))/SR;n=rng.normal(0,1,len(t));v=(np.sin(2*np.pi*freq*t)*np.exp(-t*26)+n*np.exp(-t*90)*.35)*gain;i=int(start*SR);a[i:i+len(v)]+=v[:max(0,len(a)-i)]
a=np.zeros(int(2.8*SR));knock(a,.02,.48,480);knock(a,.14,.25,670)
t=np.arange(len(a))/SR;a+=np.sin(2*np.pi*(75*t+11*t*t))*.06*np.exp(-((t-.5)/.35)**2)
for i,f in enumerate([220,261.63,329.63,392,493.88,440]):tone(a,.35+i*.32,f,.8,.21)
write('opening',a)
a=np.zeros(8*SR)
for beat,f in enumerate([220,329.63,261.63,392,246.94,329.63,293.66,415.3,220,329.63,261.63,392,246.94,293.66,329.63,207.65]):tone(a,beat*.5,f,.48,.095)
for i in range(8):knock(a,i+.04,.025,880,.08)
write('offer',a)
a=np.zeros(int(1.2*SR));t=np.arange(len(a))/SR;a+=rng.normal(0,1,len(a))*.018*np.sin(np.pi*np.clip(t/.6,0,1))
tone(a,.04,220,.45,.12);tone(a,.18,164.81,.5,.1);knock(a,.82,.7,75,.25);knock(a,1.08,.3,650,.1);write('closing',a)
a=np.zeros(int(1.2*SR));knock(a,.04,.14,300);tone(a,.05,523.25,.55,.2);tone(a,.16,659.25,.6,.14);knock(a,.82,.55,90,.25);knock(a,1.08,.2,650,.1);write('take',a)
