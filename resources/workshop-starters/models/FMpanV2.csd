<CsoundSynthesizer>

<CsOptions>
-dm0 -Ma
</CsOptions>

<CsInstruments>
nchnls	=	2
0dbfs = 1

	; turn default MIDI routing off
massign		0, 0
	; route note events on channel 1 to instr 1
massign		1, 1

	; Define MIDI controllers
#define C1 #21#
#define C2 #22#
#define C3 #23#

ctrlinit 1, $C1,100, $C2,64, $C3,21

instr 1
icps	cpsmidi
iamp	ampmidi	1

kgain      midic7 $C1, 0,1
kmodIndex	midic7 $C2, 0,20
kmodIndex	port	kmodIndex, .1
kpan				midic7 $C3, 0,1						;Pan

kenv	  linsegr	0, .01, iamp, 2, iamp* .5, 1, iamp*.2, .25, 0
kenv2	expon	30, .1, 1				;Index of Modulation Envelope
afm	  foscil	kenv*kgain, icps, 1, .5, kenv2+kmodIndex, 1		

aleft	=	afm * (sqrt(1-kpan))			;Pan Left
aright	=	afm * (sqrt(kpan))			;Pan Right
outs	aleft, aright					;Outs the Signals
endin
</CsInstruments>

<CsScore>
f0 z
f1	0	8192	10	1
f2	0	8192	7	-1	8192	1
f3	0	8192	7	1	4096	1	0	-1	4096	-1
f4	0	8192	21	1
</CsScore>
</CsoundSynthesizer>
