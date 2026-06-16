<CsoundSynthesizer>
<CsOptions>

; XO
;-+rtmidi=alsa  --midi-device=hw:1,0 -+rtaudio=alsa -odac -r16000 -k160 ;-O stdout
; Mac
;-odac -r44100 -k441

</CsOptions>
<CsInstruments>

;===============;
; {_ORCHESTRA_} ;
;===============; 

;===========================================================================================

	instr 1	;ULTRAFAT FM/ANALOG/WAVESHAPE PAD
	
aout 	init 	0
kdeclick  linen     1, .01,p3,.01

ifdbk     =         .6  				;CASCADED FM SECTION (I GOT THIS FROM SOMEWHERE)                     
iamp      =         1
ipor      =         cpspch(p4)
imod1     =         2*ipor
indx1     =         3
imod2     =         1.33*ipor
indx2     =         3
kndx1     linseg    0,p3/3,indx1,p3/2,indx1
kndx2     linseg    0,p3/2,indx2,p3/3,indx2
amod1     oscil3    imod1*kndx1,imod1,1
amod2     oscil3    imod2*kndx2,imod2+amod1,1
apor      oscil3    iamp/2,ipor+amod2, 1
kamp      linen     1,p3/3,p3,p3/3
 
kfco      linseg    200, p3/4, 10000,p3/4, 4000, p3/2,50	 ;ANALOG LPF SECTION
kres      linseg    0,p3/3,0,p3/3, .5 ,p3/3, .2
alpf0     moogvcf   apor*kamp-ifdbk*aout, kfco,kres
adist      =        .5*tanh(apor*kamp)                     
alpf1     tonex     -adist,sr/4                             
alpf2     tonex     alpf1,sr/8
alpf3     tonex     -alpf2,sr/16
alpf4     tonex     alpf3,sr/32
 
awsh1     table3    .5+alpf1,2,1		;MULTIBAND WAVESHAPER SECTION
awsh2     table3    .5+alpf2,3,1
awsh3     table3    .5+alpf3,4,1
awsh4     table3    .5+alpf4,5,1
aout      =         awsh1+awsh2+awsh3+awsh4
          out       2000*aout * kdeclick
      
endin 

;===========================================================================================

</CsInstruments>
<CsScore>

;===========;
; {_SCORE_} ;
;===========; 

;SINE WAVE
;===========================
f1 0 8192 10 1		; GEN10
;===========================

; TR.FT
;========================================================================
f2 0 8193 13 1 1  0  6 -2  0  0 0 0  0  0 0 0 0 0 0 0 0 0		; GEN13
f3 0 8193 13 1 1  0  0 0 -2 4 0 0  0  0 0 0 0 0 0 0 0 0		; GEN13
f4 0 8193 13 1 1  0  0 0  0  0 5 -1 -7 3 0 0 0 0 0 0 0 0		; GEN13
f5 0 8193 13 1 1  0  0 0  0  0 0 0  0  0 8 -5 -6 2 4 -1 -2 1	; GEN13
;========================================================================

;============== 
i1 0  5  6.00
i1 4  .  7.00
i1 8  .  8.00
i1 12 .  9.00
e

</CsScore>
</CsoundSynthesizer>

;_Notes_

;ANOTHER EMPHYRICAL INSTRUMENT
	;JOSEP M COMAJUNCOSAS / FEB 99<bsbPanel>
 <label>Widgets</label>
 <objectName/>
 <x>328</x>
 <y>523</y>
 <width>948</width>
 <height>178</height>
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
  <uuid>{874f81cc-1828-483a-afe0-ec484a0fedfc}</uuid>
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
WindowBounds: 328 523 948 178
CurrentView: io
IOViewEdit: On
Options:
</MacOptions>

<MacGUI>
ioView nobackground {59367, 11822, 65535}
ioSlider {5, 5} {20, 100} 0.000000 1.000000 0.000000 slider1
</MacGUI>
