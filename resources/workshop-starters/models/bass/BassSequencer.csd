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

;================================================================

	instr 1 ; Step Sequencer: 2*VCOs, 'Moog'VCF, VCA, Env.
 
ilevl    	= 		p4*32767 ; Output level
itabl1   	= 		p5       ; Pitch table
imult    	= 		p6       ; Pitch multiplier
idet     	= 		p7/2     ; VCO detune
ivcf     	= 		p8       ; VCF cut-off frequency
 
k1       	phasor  	1/p3
k2       	table  	k1, itabl1, 1
kenv1    	oscil  	1, 8/p3, 3	
kenv2    	oscil  	1, 8/p3, 5
kf       	= 		kenv1*ivcf
avco1    	oscil  	.5, cpspch(k2)*imult - idet, 8, -1
avco2    	oscil  	.5, cpspch(k2)*imult + idet, 8, -1
avcos    	= 		avco1 + avco2
avcf     	moogvcf  	avcos, kf, .1
		out      	avcf*ilevl*kenv2
 
endin

;================================================================
 
</CsInstruments>
<CsScore>

;===========;
; {_SCORE_} ;
;===========; 

;================================================================================
f1 0 8 -2  08.00  08.03  08.07  08.07  08.07  08.03  08.00  07.00 ; GEN2/Pitches
f2 0 8 -2  07.03  07.02  07.00  07.07  07.05  07.03  07.02  06.07 ; GEN2/Pitches
;================================================================================

;=========================================================
;f3 0 1024 -7 0 14 1 1010 0 		; GEN7/Linear Env
f3 0 1024 -5 .001 14 1 1010 .001 	; GEN5/Exponential Env
;=========================================================
 
;==================================================== 
f5 0 1024 -5 .001 12 1 1000 1 12 .001 ; GEN5/VCA Env
;====================================================
 
;==========================================
f8 0 1024 7 0 512 1 0 -1 512 0	; GEN7
;==========================================
 
;   Strt  Leng  Levl  Table Freq* Detun Cut-Off
;==============================================
i1  0.00  1.00  0.75  2     1     1.00  4000
i1  +     .     .     .     .     .     .
i1  0.00  2.00  0.50  1     1     2.00  2000
e
 
</CsScore>
</CsoundSynthesizer><bsbPanel>
 <label>Widgets</label>
 <objectName/>
 <x>0</x>
 <y>465</y>
 <width>633</width>
 <height>170</height>
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
  <uuid>{902be0ec-2f53-421d-bfd2-fdfbf4828651}</uuid>
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
WindowBounds: 0 465 633 170
CurrentView: io
IOViewEdit: On
Options:
</MacOptions>

<MacGUI>
ioView nobackground {59367, 11822, 65535}
ioSlider {5, 5} {20, 100} 0.000000 1.000000 0.000000 slider1
</MacGUI>
