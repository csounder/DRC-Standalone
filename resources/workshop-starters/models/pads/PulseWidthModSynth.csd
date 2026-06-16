<CsoundSynthesizer>
<CsInstruments>

sr 		= 		44100
kr 		= 		441
ksmps 	= 		100
nchnls 	= 		1

;===============;
; {_ORCHESTRA_} ;
;===============; 

;========================================================================================================

	instr 1	; A SIMULATION OF AN ANALOG SYNTHESIZER WITH A PULSE WAVE OSCILLATOR/SAWTOOTH OSCILLATOR
	
ilforate  = 		2.3					; LFO SPEED IN Hz
isawlvl   = 		0.5	 				; LEVEL OF SAWTOOTH WAVEFORM
ipwmlvl   = 		0.5	 				; LEVEL OF PULSE WAVEFORM
ipwm	   	= 		0.2	 				; DC OFFSET OF PULSE width
ipwmlfo   = 		0.1	 				; DEPTH OF PULSE WIDTH MODULATION
ivcffrq   = 		800	 				; CUTOFF OF GLOBAL LOW PASS FILTER
ienvflt   = 		200	 				; MAX CHANGE IN LPF CUTOFF BY ENVELOPE
ikbdflt   = 		0.1	 				; RELATIVE CHANGE IN LPF CUTOFF TO PITCH
iatt	   	= 		0.2	 				; ATTACK LENGTH COMPARED TO NOTE DURATION
idec	   	= 		0.1	 				; DECAY LENGTH COMPARED TO NOTE DURATION
isus	   	= 		0.8	 				; SUSTAIN LEVEL (1 IS FULL STRENGTH)
irel	   	= 		0.2	 				; RELEASE LENGTH COMPARED TO NOTE DURATION
isteady   = 		1-(iatt+idec+irel)		; LENGTH OF SUSTAIN LEVEL

; The Oscillators
klfo	 	oscil   	1, ilforate, 1	   				; GENERATE LFO
asaw	 	oscili  	1, p5, 3		   				; GENERATE SAWTOOTH
apwm	 	table   	asaw/2+(klfo*ipwmlfo+ipwm),4,1,0.5 
awaves	 =	    	isawlvl*asaw+ipwmlvl*apwm		; MIX THE WAVEFORMS

; THE ENVELOPE
kenv	 	linseg  	0,iatt*p3,1,idec*p3,isus,isteady*p3,isus,irel*p3,0

; THE FILTERS
klpfcut 	=		ivcffrq+p5*ikbdflt+ienvflt*kenv
alpf	 	butterlp	awaves, klpfcut
aout	 	=		p4*kenv*alpf 
		out 		aout

endin

</CsInstruments>
<CsScore>

;===========;
; {_SCORE_} ;
;===========; 

;===========================================================================
f 1   0 1024   10   1                    ; GEN10/Lfo sine wave
f 3   0 1024   7    -1 1024 1            ; GEN7/Sawtooth waveform
f 4   0 1024   7    -1 512 -1 0 1 512 1  ; GEN7/Comparator (pulse) waveform
;===========================================================================

;===============
i1 0 6 6000 110
i1 0 6 6000 165 
i1 1 5 6000 55
i1 1 5 4000 440
i1 1 5 4000 220
i1 1 5 4000 660
i1 1 5 4000 330
i1 6 6 6000 87
i1 6 6 6000 131
i1 6 6 6000 44
i1 6 6 4000 349
i1 6 6 4000 523
i1 6 3 4000 262
i1 9 3 4000 294
i1 12 3 4000 330
i1 12 6 6000 110
i1 12 6 6000 165
i1 12 6 6000 55
i1 12 6 4000 440
i1 12 6 4000 220
i1 12 6 4000 660
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
  <uuid>{1b4f07af-ba72-47d3-a6a4-5bf2b72cdcf1}</uuid>
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
