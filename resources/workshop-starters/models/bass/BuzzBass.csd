<CsoundSynthesizer>
<CsOptions>

; XO
;-+rtmidi=alsa  --midi-device=hw:1,0 -+rtaudio=alsa -odac -r16000 -k160 ;-O stdout
; Mac
-odac -r44100 -k441

</CsOptions>
<CsInstruments>

;===============;
; {_ORCHESTRA_} ;
;===============; 

;========================================================================

	instr 1	; Gbuzz instrument.
	
ilevl    	= 		p4*32767               ; Output level
ipitch   	= 		cpspch(p5)             ; Pitch
ihigh    	= 		int((.5*sr)/ipitch*p6) ; Highest harmonic < nyquist
ilow     	= 		p7                     ; Lowest harmonic
iharm1   	= 		p8                     ; Start harmonic curve
iharm2   	= 		p9                     ; End harmonic curve
 
k1       	line 	iharm1, p3, iharm2
a1       	gbuzz	1, ipitch, ihigh, ilow, k1, 1, -1
 		out      	a1*ilevl
 		
endin 

;======================================================================== 
 
</CsInstruments>
<CsScore>

;=================================
f1 0 16384 9 1 1 90 ; GEN9 Cosine 
;=================================
 
t 0 280 ; 4*Tempo
 
;             -------Harmonics-------
;     Strt  Leng  Levl  Pitch Num.  Low.  Harm1 Harm2
;========================================================================
i1    0.00  1.00  1.00  07.00 1     1     1.00  0.10
i1    +     .     .     06.07 .     .     ~     ~
i1    +     .     .     06.09 .     .     ~     ~
i1    +     .     .     07.09 .     .     ~     ~
i1    +     .     .     07.00 .     .     ~     ~
i1    +     .     .     07.03 .     .     ~     ~
i1    +     2.00  .     07.05 .     .     0.10  1.00
e

</CsScore>
</CsoundSynthesizer>

;_Notes_

; Steven Cook<bsbPanel>
 <label>Widgets</label>
 <objectName/>
 <x>0</x>
 <y>557</y>
 <width>1276</width>
 <height>192</height>
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
  <uuid>{2c9829e9-8e43-406c-9a29-8036c0b50f17}</uuid>
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
WindowBounds: 0 557 1276 192
CurrentView: io
IOViewEdit: On
Options:
</MacOptions>

<MacGUI>
ioView nobackground {59367, 11822, 65535}
ioSlider {5, 5} {20, 100} 0.000000 1.000000 0.000000 slider1
</MacGUI>
