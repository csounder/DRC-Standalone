<CsoundSynthesizer>
<CsInstruments>
ksmps 	= 		32
nchnls 	= 		2

0dbfs = 32768

gaDelL  init
gaDelR  init

gaRvbL  init
gaRvbR  init

turnon "Reverb"
turnon "Delay"
 
        instr 6
inote   =       cpspch( p4)
kamp    linen   .2, .1, p3, .1
a1      oscil   10000, inote - .5, 2
a2      oscil   10000, inote + .5, 2
a3      oscil   10000, inote / 2 , 2
kfreq   line    4000, 4.1, 100
afil    butterlp (a1 + a2 + a3), kfreq
afil2   butterbp afil, kfreq, 50

aSig =     kamp * (5 * afil2 + afil)
 
aL, aR  pan2 aSig*.9, 0.5

gaDelL  += aL * .35
gaDelR  += aR * .35
gaRvbL  += aL * .12
gaRvbR  += aR * .12
  outs aL, aR
    endin

    instr Delay
        denorm gaDelL, gaDelR
aDelL = multitap(gaDelL, .75, .95, .75*3, \
                .70, .75*5, .43, .75*7, .15)
aDelR = multitap(gaDelR, .75*2, .83, .75*4, \
                .57, .75*6, .31, .75*8, .05)
  outs aDelL, aDelR
   clear gaDelL, gaDelR
    endin

    instr Reverb
    denorm gaRvbL, gaRvbR
aL,aR   reverbsc gaRvbL, gaRvbR, .94, 12000
  outs aL, aR
   clear gaRvbL, gaRvbR
    endin	
</CsInstruments>
<CsScore>
f2 0 1024 7 0 2 1 1022 0
i6      0   4   7.00
i6      0   4   6.00
i6      4   4   7.00
i6      4   4   6.00
i6      3   1.5 7.08
i6      3   1.5 8.00
i6      3   1.5 8.03
i6      4.5 1.5 7.10
i6      4.5 1.5 8.02
i6      4.5 1.5 8.05
i6      6   2   8.00
i6      6   3   8.04
i6      6   3   8.07
e 35
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
