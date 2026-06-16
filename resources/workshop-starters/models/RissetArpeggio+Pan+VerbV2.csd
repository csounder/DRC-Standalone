<CsoundSynthesizer>

<CsOptions>
-dm0 -Ma
</CsOptions>

<CsInstruments>

nchnls	=	2
0dbfs = 1

garvb init 0

	; turn default MIDI routing off
massign		0, 0
	; route note events on channel 1 to instr 1
massign		1, 1

	; Define MIDI controllers
#define C1 #1#
#define C2 #2#
#define C3 #3#
#define C4 #4#
#define C5 #5#

;================ARPEGGIO.O=================
;THIS INSTRUMENT, DESIGNED BY RISSET, PRODUCES AN ARPEGGIATION IN THE
;HARMONIC SERIES.  ONE CAN HEAR VERY CLEARLY THE INDIVIDUAL HARMONICS
;COME INTO PHASE.  THE PHENOMENON OF BEATING IS AGAIN THE MEANS FOR
;DOING THIS.  SEE THE RELAVENT PASSAGE IN CHAPTER 3 (PP. 101-102) DODGE.

ctrlinit 1, $C1,100, $C2,0, $C3,10, $C4,64, $C5,64

				instr          1
knote       	cpsmidib
iveloc      	ampmidi   1

kvol  midic7 $C1, 0,1
iatk  midic7 $C2, .01,2
irel  midic7 $C3, .1,3
kpan  midic7 $C4, 0,1
krvb  midic7 $C5, 0,.5

;printk 1, krvb

;p4 = FREQ OF FUNDAMENTAL (HZ)
;p5 = AMP
;p6 = INITIAL OFFSET OF FREQ - .03 HZ
;INIT VALUES CORRESPOND TO FREQ. OFFSETS FOR OSCILLATORS BASED ON ORIGINAL P6
i1             	=         1*.03
i2             	=         2*.03
i3             	=         3*.03
i4             	=         4*.03

ampenv         	linenr    iveloc,iatk,irel,.01      ;A SIMPLE ENVELOPE TO PREVENT CLICKING.

a1             	oscili    ampenv,knote,1      ;NINE OSCILLATORS WITH THE SAME AMPLITUDE ENV
a2             	oscili    ampenv,knote+i1,1   ;AND WAVEFORM, BUT SLIGHTLY DIFFERENT
a3             	oscili    ampenv,knote+i2,1   ;FREQUENCIES TO CREATE THE BEATING EFFECT
a4             	oscili    ampenv,knote+i3,1
a5             	oscili    ampenv,knote+i4,1
a6             	oscili    ampenv,knote-i1,1
a7             	oscili    ampenv,knote-i2,1
a8             	oscili    ampenv,knote-i3,1
a9             	oscili    ampenv,knote-i4,1

amix 					=      ((a1+a2+a3+a4+a5+a6+a7+a8+a9)/9) * kvol

    outs amix*(1-kpan), amix*(kpan)
 
garvb          =       garvb+(amix*krvb)  
				endin
				
				
				instr 99
				
asigL    nreverb garvb, 2.91, .4
asigR    nreverb garvb, 3.78, .3
				outs  asigL*.25, asigR*.25
				
				garvb = 0
				
				endin
 
</CsInstruments>

<CsScore>
f0 z
; RISSET'S ARPEGGIO SCORE
f1 0 1024 10 1 0 0 0 .7 .7 .7 .7 .7 .7
i 99 0 -1
</CsScore>

</CsoundSynthesizer>
