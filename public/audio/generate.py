# Original synthesized recordings of traditional public-domain melodies. No samples.
import math, wave, struct
from pathlib import Path
notes={'C':261.63,'D':293.66,'E':329.63,'F':349.23,'G':392,'A':440,'B':493.88,'c':523.25,'d':587.33,'e':659.25,'g':784}
songs={
 'twinkle': 'C C G G A A G - F F E E D D C - G G F F E E D - G G F F E E D - C C G G A A G - F F E E D D C -',
 'jacques': 'C D E C C D E C E F G - E F G - G A G F E C G A G F E C C G C - C G C -',
 'ode': 'E E F G G F E D C C D E E D D - E E F G G F E D C C D E D C C -',
 'birthday': 'G G A G c B - G G A G d c - G G g e c B A - F F e c d c -',
 'saints': 'C E F G - - C E F G - - C E F G E C E D - E E D C C E G G F - E F G E C D C -',
 'london': 'G A G F E F G - D E F - E F G - G A G F E F G - D G E C - -'}
rate=22050
for name,sequence in songs.items():
 data=[]
 for repeat in range(2):
  for n in sequence.split():
   for i in range(int(rate*.32)):
    t=i/rate; env=min(1,t/.008)*math.exp(-t*6)*min(1,(.32-t)/.025)
    f=notes.get(n,0); v=(math.sin(2*math.pi*f*t)+.22*math.sin(4*math.pi*f*t))*.45*env if f else 0
    data.append(struct.pack('<h',int(v*32767)))
 with wave.open(str(Path(__file__).parent/(name+'.wav')),'wb') as w:
  w.setparams((1,2,rate,0,'NONE','not compressed')); w.writeframes(b''.join(data))
