<CsoundSynthesizer>

<CsOptions>
; XO
;-+rtmidi=alsa  --midi-device=hw:1,0 -+rtaudio=alsa -odac -r16000 -k160 ;-O stdout
; Mac
-odac -r44100 -k44100
</CsOptions>

<CsInstruments>
sr=44100
kr=44100

nchnls         =         2

gasig          init      0
 

instr          1                             ;TEKNO BASS CODED BY RADU GRIGOROVICI
idur           =         p3
iamp           =         p4
ifre           =         cpspch(p5)
kamp           linseg    0, 0.01, p4, p3/3, p4, p3/3, p4/4, p3/3-0.1, 0
kcut           linseg    10000, p3, 1000
kres           linseg    880, p3, 440
kres2          linseg    220, p3, 110
asig1          oscili    kamp, ifre, 1
asig2          butterlp  asig1, kcut
asig3          reson     asig2, kres, 110
asig4          balance   asig3, asig2
asig5          =         asig4/2
               outs      asig5, asig5
endin
 
instr          2                             ;TEKNO BASS DRUM CODED BY RADU GRIGOROVICI
idur           =p3
iamp           =p4
kamp           linseg    0, 0.001, p4, 2*p3/3, p4, p3/3-0.01, 0
kpch           expseg    330, p3, 0.001
kcut           expseg    440, p3, 0.001
kres           expseg    440, p3, 0.001
asig0          oscili    kamp, kpch+110, 1
asig1          rand      kamp
asig2          =         asig1+asig0
asig3          butterlp  asig2, kcut*10
asig4          reson     asig3, kres+440, 220
asig5          balance   asig4, asig0
asig6          =         asig5/2
               outs      asig6, asig6
endin
 
instr          3                             ;TEKNO HIGHS CODED BY RADU GRIGOROVICI
idur           =         p3
iamp           =         p4
kamp           linseg    0, 0.001, p4, p3-0.01, 0
kpch           expseg    12000, p3, 8000
kcut           expseg    12000, p3, 8000
kres           expseg    12000, p3, 8000
asig1          rand      kamp
asig2          =         asig1
asig3          butterbp  asig2, kcut, 880
asig4          reson     asig3, kres, 880
asig5          balance   asig4, asig1
asig6          =         asig5/2
outs           asig6, asig6
endin 
</CsInstruments>

<CsScore>
f1 0  1024   8  1  256 .2  128 0 256 -.2 256  -1
t 0 144
 
;inst start dur amp   frec 

i1 0.00 0.25 14000 6.0
i1 0.50 0.25 . 7.0
i1 0.75 0.25 . 6.0
i1 1.25 0.25 . 7.0
i1 1.50 0.25 . 6.0
i1 2.00 0.25 . 7.0
i1 2.50 0.25 . 6.0
i1 3.00 0.25 . 6.10
i1 3.50 0.25 . 7.0
e
</CsScore>


</CsoundSynthesizer>
<bsbPanel>
 <label>Widgets</label>
 <objectName/>
 <x>100</x>
 <y>100</y>
 <width>320</width>
 <height>240</height>
 <visible>true</visible>
 <uuid/>
 <bgcolor mode="background">
  <r>240</r>
  <g>240</g>
  <b>240</b>
 </bgcolor>
</bsbPanel>
<bsbPresets>
</bsbPresets>
