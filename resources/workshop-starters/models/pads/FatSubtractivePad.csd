<CsoundSynthesizer>
<CsInstruments>

sr      =       44100
kr      =       441
ksmps   =       100
nchnls  =       1
 
;===============;
; {_ORCHESTRA_} ;
;===============; 

;===========================================
 
	instr 6	; Subctractive Fat Pad
	
inote   =       cpspch( p4)
kamp    linen   .2, .1, p3, .1
a1      oscil   10000, inote - .5, 2
a2      oscil   10000, inote + .5, 2
a3      oscil   10000, inote / 2 , 2
kfreq   line    4000, 4.1, 100
afil    butterlp (a1 + a2 + a3), kfreq
afil2   butterbp afil, kfreq, 50
        out     kamp * (5 * afil2 + afil)
        
endin

;===========================================
        
</CsInstruments>
<CsScore>

;===========;
; {_SCORE_} ;
;===========; 

;=======================================
f2 0 1024 7 0 2 1 1022 0		; GEN7
;=======================================

;====================
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
e

</CsScore>
</CsoundSynthesizer><bsbPanel>
 <label>Widgets</label>
 <objectName/>
 <x>72</x>
 <y>179</y>
 <width>400</width>
 <height>200</height>
 <visible>true</visible>
 <uuid/>
 <bgcolor mode="nobackground">
  <r>231</r>
  <g>46</g>
  <b>255</b>
 </bgcolor>
 <bsbObject version="2" type="BSBVSlider">
  <objectName>slider1</objectName>
  <x>5</x>
  <y>5</y>
  <width>20</width>
  <height>100</height>
  <uuid>{6295cbd4-5b58-40fc-b9c6-54b23f0c2a3f}</uuid>
  <visible>true</visible>
  <midichan>0</midichan>
  <midicc>-3</midicc>
  <minimum>0.00000000</minimum>
  <maximum>1.00000000</maximum>
  <value>0.00000000</value>
  <mode>lin</mode>
  <mouseControl act="jump">continuous</mouseControl>
  <resolution>-1.00000000</resolution>
  <randomizable group="0">false</randomizable>
 </bsbObject>
</bsbPanel>
<bsbPresets>
</bsbPresets>
<MacOptions>
Version: 3
Render: Real
Ask: Yes
Functions: ioObject
Listing: Window
WindowBounds: 72 179 400 200
CurrentView: io
IOViewEdit: On
Options:
</MacOptions>

<MacGUI>
ioView nobackground {59367, 11822, 65535}
ioSlider {5, 5} {20, 100} 0.000000 1.000000 0.000000 slider1
</MacGUI>
