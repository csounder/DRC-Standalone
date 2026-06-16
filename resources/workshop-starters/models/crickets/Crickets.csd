<CsoundSynthesizer>
<CsInstruments>

sr		= 	44100
kr		= 	441
ksmps	= 	100
nchnls 	= 	2 

;===============;
; {_ORCHESTRA_} ;
;===============; 

;=====================================================================================================================================

	instr 14	; Crickets
	
idur           =              p3                  ; DURATION
iamp           =              p4                  ; AMPLITUDE
ifqc           =              p5                  ; FREQUENCY MODIFICATION
ipuls          =              p6                  ; PULSE TABLE
iftab          =              p7                  ; FREQUENCY TABLE
iloop          =              p8                  ; LOOP TIME
iltab          =              p9                  ; LOOP TABLE
ilpetab        =              p10                 ; LOOP ENVELOPE TABLE
ifetab         =              p11                 ; FREQUENCY ENVELOPE TABLE
ibasef         =              19                  ; BASE PULSE FREQUENCY
ipanl          =              sqrt(p12)           ; PAN LEFT
ipanr          =              sqrt(1-p12)         ; PAN RIGHT
iv             =              iamp/10000          ; HIGH SHELF LEVEL
 
kaf            oscili         2, 1/iloop, iltab        ; PULSE ENVELOPE FM
kamp1          oscili         1, 1/iloop, ilpetab      ; LOOP ENVELOPE
kfenv          oscili         1, 1/iloop, ifetab       ; LOOP FREQUENCY ENVELOPE     
kamp2          oscili         1, ibasef*kaf, ipuls     ; GENERATE PULSE STREAM
kamp           =              sqrt(kamp1*kamp2)        ; MAKE IT ROUNDED 

kfqc1          oscil          4800*kfenv*ifqc, ibasef*kaf, iftab      ; FUNDAMENTAL FQC
kfqc2          oscil          9500*kfenv*ifqc, ibasef*kaf, iftab      ; OVERTONE 

kdclck         linseg         0, .005, 1, idur-.01, 1, .005, 0        ; DECLICK ENVELOPE 

afnd           oscil          kamp, kfqc1, 1                          ; FUNDAMENTAL OSCILLATOR
ahrm           oscil          kamp, kfqc2, 1                          ; OVERTONE OSCILLATOR 
aout           pareq          (afnd+ahrm*.04)*iamp*kdclck, 7000, iv, .707, 2    ; SET HIGH SHELF FILTER LOW FOR DISTANT CRICKETS
               outs           aout*ipanl, aout*ipanr                  ; OUTPUT THE SOUND WITH PANNING
               
endin
 
;=====================================================================================================================================

</CsInstruments>
<CsScore>

;===========;
; {_SCORE_} ;
;===========; 

;==============================================================================
f1 0 65536 10 1									; GEN10
f2 0 1024  7  0 306 1   306 0   412 0					; GEN7
f3 0 1024  7  1 153 .97 153 .92 306 .85 412 1			; GEN7
f4 0 1024  7  1  43 1    10  .5  961 .5 10 1				; GEN7
f5 0 1024  7  .5 43 .5   10  .8  240 1 10 0 721 0 10 .5     ; GEN7 LOOP ENVELOPE
f8 0 1024  7  .5 43 .5   10  .8  300 1 10 0 661 0 10 .5     ; GEN7 LOOP ENVELOPE
f6 0 1024  7  .9 43 .9   10  1   961 1 10  .9			; GEN7
f7 0 1024  7  1 1024 1								; GEN7
;==============================================================================

;    Sta  Dur   Amp    Fqc  PlsTab  FqcTab  Loop  LoopFM   LoopEnv  FqcEnv Pan
;==============================================================================
i14  0 	30   3200   .858  2       3       .5    4        8        6     .9 
i14  0.75 30   5300   1.05  2       3       .6    4        8        6     .8
e
i14  1.5  30   3500   .992  2       3       .6    4        5        6     .6

</CsScore>
</CsoundSynthesizer>

; CRICKETS
; CODED BY HANS MIKELSON SEPTEMBER, 1999

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
<bsbPanel>
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
 <bsbObject type="BSBVSlider" version="2">
  <objectName>slider1</objectName>
  <x>5</x>
  <y>5</y>
  <width>20</width>
  <height>100</height>
  <uuid>{cb2288cc-7ca2-41e9-aadd-4385051c9a8c}</uuid>
  <visible>true</visible>
  <midichan>0</midichan>
  <midicc>-3</midicc>
  <description/>
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
