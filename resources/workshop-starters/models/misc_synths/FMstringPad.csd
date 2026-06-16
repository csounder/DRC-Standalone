<CsoundSynthesizer>
<CsInstruments>
ksmps     =         32
nchnls    =         2
0dbfs = 32768

gaDelL  init
gaDelR  init

gaRvbL  init
gaRvbR  init

turnon "Reverb"
turnon "Delay"

;=======================================================================;
; FMSTRINGS       FM Strings based on Dodge's "Computer Music" Text     ;
;                 Designed by Garth Molyneux                            ;
;                 University of Texas at Austin Computer Music Studio   ;
;=======================================================================;
; p5     =        frequency in pch                                      ;
; p6     =        relative index level                                  ;
; p7     =        code for envelope rise and fall times                 ;
;                    1 = fast rise/fast fall, 2 = fast rise/slow fall   ;
;                    3 = slow rise/fast fall, 4 = slow rise/slow fall   ;
; p8     =        code for index envelope rise time                     ;
;                    0 = fast, 1 = slow                                 ;
;=======================================================================;
          instr     1         
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
          if        (p8 == 1) goto step1
kindx1c   envlpx    indx1,.02,p3,p3-.02,2,.999,.01
kindx2c   envlpx    indx2,.03,p3,p3-.03,2,.997,.01
kindx3c   envlpx    indx3,.04,p3,p3-.04,2,.998,.01
          goto      step2
step1:
kindx1c   envlpx    indx1,p3*.698,p3,p3*.302,6,.999,.01
kindx2c   envlpx    indx2,p3*.703,p3,p3*.297,6,.996,.01
kindx3c   envlpx    indx3,p3*.695,p3,p3*.305,6,.996,.01     
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
          if        (p7 == 2) igoto set2
          if        (p7 == 3) igoto set3
          if        (p7 == 4) igoto set4
          igoto     set1
set2:
ienvf     =         (p3-.17)*.95
          igoto     set1
set3:
ienvr     =         (p3-.21)*.9
ienvfn    =         7
          igoto     set1
set4:
ienvr     =         p3*.5
ienvf     =         p3*.5
ienvfn    =         7 
set1:
asnd      envlpx    asig,ienvr,p3,ienvf,ienvfn,.998,.01
asine     oscili    p4*.6,ipitch,1
asinenv   linen     asine,p3*.5,p3,p3*.4
asignal   =         asnd+asinenv
aSig  = asignal*.2
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
;=======================================================================;
; FMSTRINGS       Score for FM Strings based on Dodge coded by Molyneux ;
;=======================================================================;
; p6     =        relative index level                                  ;
; p7     =        code for envelope rise and fall times                 ;
;                    1 = fast rise/fast fall, 2 = fast rise/slow fall   ;
;                    3 = slow rise/fast fall, 4 = slow rise/slow fall   ;
; p8     =        code for index envelope rise time                     ;
;                    0 = fast, 1 = slow                                 ;
;=======================================================================;
; sine
f1     0       512    10       1
; linear rise
f2     0       513     7       0       513         1
; linear fall
f3     0       513     7       1       513         0
; attack function for vibamp
f4     0       513     7       0       400         1       113    .8 
; attack function for vibamp
f5     0       513     7       0       200        .56      250     1       63     .85 
; index rise function
f6     0       513     5      .001     62         .95      61     .55      200     1       190     .86
; attack function
f7     0       513     5      .001     200        .95      156    .7       157     1
;=========================================================================;
; FMSTRINGS            p4      p5       p6      p7      p8                ;
;                      amp     pch      relndx  eg#     ndxeg             ;
;=========================================================================;
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
