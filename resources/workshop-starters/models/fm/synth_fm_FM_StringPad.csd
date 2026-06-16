<CsoundSynthesizer>
<CsInstruments>
sr        =         44100
kr        =         441
ksmps     =         100
nchnls    =         1

; FMSTRINGS       FM Strings based on Dodge's "Computer Music" Text     
;                 Designed by Garth Molyneux                            
;                 University of Texas at Austin Computer Music Studio   

; p5     =        frequency in pch                                      
; p6     =        relative index level                                  
; p7     =        code for envelope rise and fall times                 
;                    1 = fast rise/fast fall, 2 = fast rise/slow fall   
;                    3 = slow rise/fast fall, 4 = slow rise/slow fall   
; p8     =        code for index envelope rise time                     
;                    0 = fast, 1 = slow                                 

;===============;
; {_ORCHESTRA_} ;
;===============; 

;==========================================================================

	instr 1         

kvamp     randi     .003,5,-1                ; VIBRATO DESIGN
kvstdy    oscil1i   0,.013,p3,4
kvibamp   =         kvstdy+kvamp+.003
kvfrq     randi     1,7,-1
ksfrq     oscil1i   .15,4.9,p3,5
kvibfrq   =         kvfrq+ksfrq+1
kvib      oscil     kvibamp,kvibfrq,1
ibasoct   =		octpch(p5)
ipitch    =		cpspch(p5)
ksinc   	=		cpsoct(ibasoct+kvib)

iampfac   =         (p4*.25)*.16             ; TREMOLO DESIGN
irfac     =         iampfac*.1
ktrnd     randi     irfac,4,-1
ktsamp    oscil1i   .41,iampfac,p3,4
ktamp     =         ktsamp+ktrnd+irfac
kvtfrq    randi     1,5,-1
kstfrq    oscil1i   .38,4,p3,5
ktfrq     =         kvtfrq+kstfrq+1
ktrem     oscil     ktamp,ktfrq,1
kamp      =         (p4*.25)+ktrem

katamp    =         p4*.1                    ; ATTACK NOISE
katramp   oscil1i   0,katamp,.12,3
katrand   randi     katramp,ipitch*.2,-1
knoise    oscil     katrand,2000,1,-1

kmod1hz   =         ksinc                    ; MAIN INSTRUMENT DESIGN
kmod2hz   =         ksinc*3
kmod3hz   =         ksinc*4
i1        =         7.5/log(ipitch)
i2        =         15/sqrt(ipitch)
i3        =         1.25/sqrt(ipitch)
indx1     =         i1*p6
indx2     =         i2*p6
indx3     =         i3*p6

;#############################################################################

          if	(p8 == 1) goto step1
			kindx1c   envlpx    indx1,.02,p3,p3-.02,2,.999,.01
			kindx2c   envlpx    indx2,.03,p3,p3-.03,2,.997,.01
			kindx3c   envlpx    indx3,.04,p3,p3-.04,2,.998,.01
          		goto      step2
         
;#############################################################################

step1:
	kindx1c   envlpx    indx1,p3*.698,p3,p3*.302,6,.999,.01
	kindx2c   envlpx    indx2,p3*.703,p3,p3*.297,6,.996,.01
	kindx3c   envlpx    indx3,p3*.695,p3,p3*.305,6,.996,.01     

;------------------------------------------------------------------------------

step2:
	kindex1   =         kindx1c*kmod1hz
	kindex2   =         kindx2c*kmod2hz
	kindex3   =         kindx3c*kmod3hz
	amod1     oscil     kindex1,kmod1hz,1,-1
	amod2     oscil     kindex2,kmod2hz,1,-1
	amod3     oscil     kindex3,kmod3hz,1,-1
	acarfrq   =         amod1+amod2+amod3+ksinc
	astr      oscili    kamp,acarfrq,1,-1
	asig      =         astr+knoise
	ienvr     =         .17
	ienvf     =         .21
	ienvfn    =         2

;#############################################################################

	if   (p7 == 2) igoto set2
     if	(p7 == 3) igoto set3
     if   (p7 == 4) igoto set4
          igoto     set1
 
;#############################################################################

set2:
	ienvf	=	(p3-.17)*.95
          igoto set1

;------------------------------------------------------------------------------

set3:
	ienvr     = 	(p3-.21)*.9
	ienvfn    =   	7
          igoto set1
          
;------------------------------------------------------------------------------

set4:
	ienvr     =     p3*.5
	ienvf     =     p3*.5
	ienvfn    =     7 

;------------------------------------------------------------------------------

set1:
	asnd      envlpx    asig,ienvr,p3,ienvf,ienvfn,.998,.01
	asine     oscili    p4*.6,ipitch,1
	asinenv   linen     asine,p3*.5,p3,p3*.4
	asignal   =         asnd+asinenv
          	out       asignal

endin

;==========================================================================

</CsInstruments>
<CsScore>

;===========;
; {_SCORE_} ;
;===========; 

; p6     =        relative index level                                  
; p7     =        code for envelope rise and fall times                 
;                    1 = fast rise/fast fall, 2 = fast rise/slow fall   
;                    3 = slow rise/fast fall, 4 = slow rise/slow fall   
; p8     =        code for index envelope rise time                    
;                    0 = fast, 1 = slow   
                              
;====================================================================================================================================================
f1     0       512    10       1															; GEN10/Sine
f2     0       513     7       0       513         1											; GEN7/Linear Rise
f3     0       513     7       1       513         0											; GEN7/Linear Fall
f4     0       513     7       0       400         1       113    .8 								; GEN7/Attack Function for Vibamp
f5     0       513     7       0       200        .56      250     1       63     .85				; GEN7/Attack Function for Vibamp
f6     0       513     5      .001     62         .95      61     .55      200     1       190     .86	; GEN5/Index Rise Function
f7     0       513     5      .001     200        .95      156    .7       157     1					; GEN5/Attack Function
;====================================================================================================================================================


; FMSTRINGS            p4      p5       p6      p7      p8                
;                      amp     pch      relndx  eg#     ndxeg             
;=============================================================
i1     0.00    5.02    7234    8.10     1       2       1
i1     0.01    5.06    7394    8.11     1       2       1
i1     0.02    5.04    7791    8.05     1       2       1
i1     0.04    5.00    7891    8.04     1       2       1
i1     4.25    5.08    9169    9.01    .5       4       0
i1     4.26    5.06    8786    8.05    .5       4       0
i1     4.27    5.04    8786    8.11    .5       4       0
i1     4.29    5.07    8786    8.02    .5       4       0
i1     8.52    6.61    7394    8.01    .7       2       1
i1     8.62    6.39    8063    8.05    .7       2       1
i1     8.65    6.40    8163    8.10    .7       2       1
i1     8.69    6.45    9772    9.04    .7       2       1
e

</CsScore>
</CsoundSynthesizer>

;_Notes_

; FMSTRINGS       
	; FM Strings based on Dodge's "Computer Music" Text     
	; Designed by Garth Molyneux                            
	; University of Texas at Austin Computer Music Studio  
	; Score for FM Strings based on Dodge coded by Molyneux ;

<MacOptions>
Version: 3
Render: Real
Ask: Yes
Functions: ioObject
Listing: Window
WindowBounds: 72 179 400 200
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
 <x>72</x>
 <y>179</y>
 <width>400</width>
 <height>200</height>
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
  <uuid>{8c668127-1a40-4762-8145-5651a471872d}</uuid>
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
