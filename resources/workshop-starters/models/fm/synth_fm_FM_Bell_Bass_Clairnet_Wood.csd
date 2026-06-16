<CsoundSynthesizer>
<CsInstruments>

sr			=		44100
kr			=		441
ksmps		=		100
nchnls		=		1

;===============;
; {_ORCHESTRA_} ;
;===============; 

;====================================================

	instr 1
	
inote		=		cpspch( p4)
ifc			=		p5
ifm			=		p6
id			=		p7*ifm		;p7 = Imax
iamp			=		p8
km			oscil	id,1/p3,p9
kc			oscil	iamp,1/p3,p10
am			oscil	km,ifm,1
ac			oscil	kc,(ifc+am),1
			out		ac

endin

;====================================================

</CsInstruments>
<CsScore>

;========================================================================
f1	0	1024	10	1									; GEN10
f2	0	1024	5	1	1000	.01							; GEN5
f3	0	1024	8	.8	50	1	100	.7	824	0			; GEN8
f4	0	512	7	1	100	0							; GEN7
f5	0	1024	7	0	100	1	124	.7	600	.7	100	0	; GEN7
f6	0	1024	7	0	100	1	824	1	100	0			; GEN7
;========================================================================

;BELL TONE
			;NOTE	FC		FM		I	AMP
;====================================================================
i1	0	15	8.00		200		280		10	10000	2	2

;WOOD DRUM
			;NOTE	FC		FM		I	AMP
;====================================================================
i1	11	.2	8.00		80		55		25	.		3	4
i1	12	.2	8.00		200		137.5	25	.		3	4

;BRASSLIKE
			;NOTE	FC		FM		I	AMP
;====================================================================
i1	13	.6	8.00		440		440		5	.		5	5

;CLARINET
			;NOTE	FC		FM		I	AMP
;====================================================================
i1	14	.5	8.00		900		800		2	.		6	6
i1	15	.5	8.00		900		800		3	.		.	.
i1	16	.5	8.00		900		800		4	.		.	.
e

</CsScore>
</CsoundSynthesizer><bsbPanel>
 <label>Widgets</label>
 <objectName/>
 <x>0</x>
 <y>465</y>
 <width>1270</width>
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
  <uuid>{81cde15f-702c-4541-bc90-06c25d10af68}</uuid>
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
<MacGUI>
ioView nobackground {59367, 11822, 65535}
ioSlider {5, 5} {20, 100} 0.000000 1.000000 0.000000 slider1
</MacGUI>
