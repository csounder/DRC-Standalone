<CsoundSynthesizer>
<CsInstruments>
ksmps 	= 		32
nchnls 	= 		2

0dbfs = 32768

gaDelL  init 0
gaDelR  init 0

gaRvbL  init 0
gaRvbR  init 0

turnon "Reverb"
turnon "Delay"

; A SIMULATION OF AN ANALOG SYNTHESIZER WITH A PULSE WAVE OSCILLATOR
; AND A SAWTOOTH OSCILLATOR


		instr 1
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
klfo	 	oscil   	1, ilforate, 1	   		; GENERATE LFO
asaw	 	oscili  	1, p5, 3		   		; GENERATE SAWTOOTH
apwm	 	table   	asaw/2+(klfo*ipwmlfo+ipwm),4,1,0.5 
awaves	 =	    	isawlvl*asaw+ipwmlvl*apwm	; MIX THE WAVEFORMS
; THE ENVELOPE
kenv	 	linseg  	0,iatt*p3,1,idec*p3,isus,isteady*p3,isus,irel*p3,0
; THE FILTERS
klpfcut 	=		ivcffrq+p5*ikbdflt+ienvflt*kenv
alpf	 	butterlp	awaves, klpfcut
aout	 	=		p4*kenv*alpf 
	aSig  = aout*.2
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
f 1   0 1024   10   1                    ;lfo sine wave
f 3   0 1024   7    -1 1024 1            ; sawtooth waveform
f 4   0 1024   7    -1 512 -1 0 1 512 1  ;comparator (pulse) waveform
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
e 24
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
