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

	instr 1	; Synth With 2 VCO's, 2 LFO's, PWM, Glide And Ringmod.
	
ilevl    = 	p4 * 32767 ; Level
inote    = 	cpspch(p5) ; Pitch
iport    = 	.0625      ; Glide Time
ivco2    = 	p6         ; VCO2 Offset
idet     = 	p7         ; VCO2 Detune
ivcf1    = 	p8         ; VCF Freq Start
ivcf2    = 	p9         ; VCF Freq End
irez     = 	p10        ; VCF Resonance
iwav1    = 	p11        ; VCO1 Waveform
iwav2    = 	p12        ; VCO2 Waveform
iwave    = 	p13        ; LFO Waveform
irate1   = 	p14        ; LFO1 Rate
irate2   = 	p15        ; LFO2 Rate
iring    = 	p16        ; Ringmod Level.
imaxd    = 	1/inote

;------------------------------------------------------------------

	tigoto	tieinit
 		ibegp    = inote
 		iprev    = inote
 			goto	cont

;------------------------------------------------------------------
 
tieinit:
	ibegp    = iprev
 	iprev    = inote
 
;------------------------------------------------------------------

cont:
	k1       linseg  ibegp, iport, inote, abs(p3), inote
	k3       expseg  ivcf1, abs(p3), ivcf2
 	k4       linseg  0, .01, ilevl, abs(p3)-.02, ilevl, .01, 0
 
 	kpwm1    oscil   .45, irate1, iwave, -1
 	kpw1     = 	  kpwm1 + .5
 	kpwm2    oscil   .45, irate2, iwave, -1
 	kpw2     = 	  kpwm2 + .5
 
 	avco1    vco  	  k4, k1, iwav1, kpw1, 1, imaxd
 	avco2    vco  	  k4, k1*ivco2 + idet, iwav2, kpw2, 1, imaxd
 	aring    = 	  avco1*avco2/32767
 	amix     = 	  (avco1 + avco2)*(1-iring) + aring*iring
 	avcf     rezzy   amix, k3, irez
 		    out     avcf
 		    
endin
 
;========================================================================

</CsInstruments>
<CsScore>

;========================================================================
f1 0 8192 10 1                         ; Sine					   ; GEN10
f2 0 4096 7 0 1024 1 2048 -1 1024 0    ; Triangle					   ; GEN7
f3 0 1024 7 1 512 1 0 -1 512 -1        ; Square				        ; GEN7
f4 0 4096 -7 0 1024 .5 2048 -.5 1024 0 ; Half Level Tri for Shallow PWM  ; GEN7
f5 0 1024 7 0 1024 0                   ; Constant 0 for No PWM/Sqr/Tri   ; GEN7
;========================================================================
 
 t 0 480
 
; Wave: 1=Saw, 2=Pwm, 3=Saw/Tri/Ramp
 
 ;                    -----VCOs------ ------VCF------ ---VCOs-- ------LFOs------
;     Strt Leng Levl Pitch Semi Fine Vcf1  Vcf2  Rez Wav1 Wav2 Wave Rate1 Rate2 Ring
;===================================================================================
i1.1  0    -2   .7   06.00 1    1    1000  200   10  2    2    2   .25   .3     .75
i1.1  +    -1   .    07.07 .    .    ~     <     .
i1.1  +    -1   .    06.00 .    .    ~     <     .
i1.1  +    1    .    07.03 .    .    ~     <     .
i1.1  +    -2   .    06.00 .    .    ~     <     .
i1.1  +    1    .    06.07 .    .    ~     <     .
i1.1  +    -2   .    07.00 .    .    ~     <     .
i1.1  +    -1   .    07.07 .    .    ~     <     .
i1.1  +    -1   .    06.00 .    .    ~     <     .
i1.1  +    -1   .    07.07 .    .    ~     <     .
i1.1  +    -2   .    06.00 .    .    ~     <     .
i1.1  +     1   .    06.03 .    .    1000  200   .
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
  <uuid>{4ded3ac2-466d-401a-b6d3-725a84d368b1}</uuid>
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
