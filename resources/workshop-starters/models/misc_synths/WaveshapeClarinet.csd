<CsoundSynthesizer>
<CsInstruments>
; ************************************************************************
; ACCCI:      40_02_1.ORC
; timbre:     clarinet-like
; synthesis:  waveshaping(40)
;             basic instrument with duration dependent envelope(02)
; source:     Risset(1969)
;             #150 Serial Excerpt with Clarinet-like Sounds by Nonlinearity
; coded:      jpg 8/93

ksmps 	= 		32
nchnls 	= 		2

0dbfs = 32768

gaDelL  init
gaDelR  init

gaRvbL  init
gaRvbR  init

turnon "Reverb"
turnon "Delay"

instr 1; *****************************************************************
idur  = p3
iamp  = p4
ifqc  = cpspch(p5)
idec  =  .64                             ; idec for idur > .75
if idur >.75 igoto start
idec  =  idur - .085                     ; idec for idur <= .75
start:
        aenv    linen    255, .085, idur, idec      ; envelope
        a1      oscili   aenv, ifqc, 1              ; sinus
        a1      tablei   a1  + 256, 31              ; transfer function

aSig =     a1 * iamp
 
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
; ************************************************************************
; ACCCI:   40_02_1.SCO
; source:  Risset (1969)
;          #150 Serial Excerpt with Clarinet-like Sounds by Nonlinearity
; coded:   jpg 8/93
; GEN functions **********************************************************
f1   0 2048 10 1                           ; sinus
f31  0  512  7 -1 200 -.5 112 .5 200 1     ; transfer function waveshaper
; score ******************************************************************
;           idur   iamp   ipch
i1  0.000   0.750  8000   7.04
i1  0.750   0.250  .      7.07
i1  1.000   1.000  .      8.00
i1  2.000   0.200  .      8.02
i1  2.200   0.200  .      8.04
i1  2.400   0.200  .      8.05
i1  2.600   0.200  .      9.00
i1  2.800   0.200  .      9.04
i1  3.000   0.250  .      9.05
i1  3.250   0.250  .      9.00
i1  3.500   0.250  .      8.05
i1  3.750   0.250  .      8.00
i1  4.000   1.000  .      7.04
i1  5.000   0.125  .      7.07
i1  5.125   0.125  .      8.00
i1  5.250   0.125  .      8.02
i1  5.375   0.125  .      8.04
i1  5.500   0.125  .      8.05
i1  5.625   0.125  .      9.00
i1  5.750   0.125  .      9.04
i1  5.875   0.125  .      9.05
e 10 
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
