<CsoundSynthesizer>
<CsInstruments>
; bassclar.orc
; instr 15 - bass clarinet
; instr 194 - reverb
sr=44100
kr=441
ksmps=100
nchnls=2

giseed = .5
giwtsin = 1
garev   init    0
;--------------------------------------------------------------------- 

instr 15                                                ; bass clarinet

;       parameters
;       p4      overall amplitude scaling factor
;       p5      pitch in Hertz (normal pitch range: sounding Gb1 - Db4)
;               bass clarinet range from Db2 - Db4, contrabass clarinet from Gb1 - Gb3
;                       (break bewteen C2 and Db2)
;       p6      percent vibrato depth, recommended values in range [-1., +1.]
;                       0.0     -> no vibrato
;                       +1.     -> 1% vibrato depth, where vibrato rate increases slightly
;                       -1.     -> 1% vibrato depth, where vibrato rate decreases slightly
;       p7      attack time in seconds 
;                       recommended value:  .06 for tongued notes (.03 for short notes)
;       p8      decay time in seconds 
;                       recommended value:  .15 (.04 for short notes)
;       p9      overall brightness / filter cutoff factor 

;                       1 -> least bright / minimum filter cutoff frequency (40 Hz)
;                       9 -> brightest / maximum filter cutoff frequency (10,240Hz)

                                                        ; initial variables
iampscale       =       p4                              ; overall amplitude scaling factor
ifreq           =       p5                              ; pitch in Hertz
ivibdepth       =       abs(p6*ifreq/100.0)             ; vibrato depth relative to fundamental frequency
iattack         =       p7 * (1.1 - .2*giseed)          ; attack time with up to +-10% random deviation
giseed          =       frac(giseed*105.947)            ; reset giseed
idecay          =       p8 * (1.1 - .2*giseed)          ; decay time with up to +-10% random deviation
giseed          =       frac(giseed*105.947)
ifiltcut        tablei  p9, 2                           ; lowpass filter cutoff frequency

iattack         =       (iattack < 6/kr ? 6/kr : iattack)               ; minimal attack length
idecay          =       (idecay < 6/kr ? 6/kr : idecay)                 ; minimal decay length
isustain        =       p3 - iattack - idecay
p3              =       (isustain < 5/kr ? iattack+idecay+5/kr : p3)    ; minimal sustain length
isustain        =       (isustain < 5/kr ? 5/kr : isustain)                     
iatt            =       iattack/6
isus            =       isustain/4
idec            =       idecay/6
iphase          =       giseed                          ; use same phase for all wavetables
giseed          =       frac(giseed*105.947)

                                                        ; vibrato block
kvibdepth       linseg  .1, .8*p3, 1, .2*p3, .7
kvibdepth       =       kvibdepth* ivibdepth            ; vibrato depth
kvibdepthr      randi   .1*kvibdepth, 5, giseed         ; up to 10% vibrato depth variation
giseed          =       frac(giseed*105.947)
kvibdepth       =       kvibdepth + kvibdepthr
ivibr1          =       giseed                          ; vibrato rate
giseed          =       frac(giseed*105.947)
ivibr2          =       giseed
giseed          =       frac(giseed*105.947)

if p6 < 0 goto vibrato1
kvibrate        linseg  2.5+ivibr1, p3, 4.5+ivibr2      ; if p6 positive vibrato gets faster
goto vibrato2
vibrato1:
ivibr3          =       giseed
giseed          =       frac(giseed*105.947)
kvibrate        linseg  3.5+ivibr1, .1, 4.5+ivibr2, p3-.1, 2.5+ivibr3   ; if p6 negative vibrato gets slower
vibrato2:
kvibrater       randi   .1*kvibrate, 5, giseed          ; up to 10% vibrato rate variation
giseed          =       frac(giseed*105.947)
kvibrate        =       kvibrate + kvibrater
kvib            oscil   kvibdepth, kvibrate, giwtsin

ifdev1  =       .015 * giseed                           ; frequency deviation
giseed  =       frac(giseed*105.947)
ifdev2  =       -.005 * giseed
giseed  =       frac(giseed*105.947)
ifdev3  =       .003 * giseed
giseed  =       frac(giseed*105.947)
ifdev4  =       .017 * giseed
giseed  =       frac(giseed*105.947)
kfreqr  linseg  ifdev1, iattack, ifdev2, isustain, ifdev3, idecay, ifdev4
kfreq   =       ifreq * (1 + kfreqr) + kvib

if ifreq <  67.13 goto range1                           ; (cpspch(6.00) + cpspch(6.01))/2
if ifreq <  95.56 goto range2                           ; (cpspch(6.06) + cpspch(6.07))/2
if ifreq <  135.16 goto range3                          ; (cpspch(7.00) + cpspch(7.01))/2
if ifreq <  191.11 goto range4                          ; (cpspch(7.06) + cpspch(7.07))/2
goto range5
                                                        ; wavetable amplitude envelopes
range1:                                                 ; for low range tones
kamp1   linseg  0, iatt, -0.012, iatt, 0.000, iatt, 0.494, iatt,        \  
0.717, iatt, 1.005, iatt, 1.396, isus, 1.838, isus, 1.616, isus,        \
1.579, isus, 1.343, idec, 1.231, idec, 0.958, idec, 0.581, idec,        \
0.000, idec, -0.089, idec, 0
kamp2   linseg  0, iatt, 0.301, iatt, 1.000, iatt, 0.891, iatt,         \
0.753, iatt, 0.499, iatt, 0.333, isus, 0.065, isus, 0.125, isus,        \
0.166, isus, -0.002, idec, 0.023, idec, -0.018, idec, 0.029, idec,      \
0.000, idec, 0.389, idec, 0
kamp3   linseg  0, iatt, -0.009, iatt, 0.000, iatt, -0.166, iatt,       \
-0.298, iatt, -0.446, iatt, -0.837, isus, -0.945, isus, -0.644, isus,   \
-0.573, isus, -0.341, idec, -0.254, idec, 0.047, idec, 0.405, idec,     \
1.000, idec, 0.486, idec, 0
iwt1    =       83                                      ; wavetable numbers
iwt2    =       84
iwt3    =       85
inorm   =       29786.7
goto end

range2:                                                 ; for low mid-range tones 

kamp1   linseg  0, iatt, 0.023, iatt, 0.062, iatt, 0.140, iatt,         \
0.605, iatt, 0.902, iatt, 1.302, isus, 1.355, isus, 1.355, isus,        \
1.202, isus, 0.934, idec, 0.891, idec, 0.654, idec, 0.225, idec,        \
0.000, idec, -0.012, idec, 0
kamp2   linseg  0, iatt, 0.035, iatt, 0.230, iatt, 0.637, iatt, .410,   \
iatt, 0.279, iatt, -.240, isus, -0.259, isus, -0.248, isus, -0.086,     \
isus, -0.090, idec, -0.109, idec, -0.074, idec, -0.037, idec, 0.000,    \
idec, 0.016, idec, 0
kamp3   linseg  0, iatt, -0.070, iatt, -0.144, iatt, -0.167, iatt,      \
-.230, iatt, -.350, iatt, -.500, isus, -0.650, isus, -0.435, isus,      \
-0.083, isus, 0.009, idec, 0.030, idec, 0.485, idec, 1.477, idec,       \
1.000, idec, 0.278, idec, 0
iwt1    =       86
iwt2    =       87
iwt3    =       88
inorm   =       23524.2
goto end

range3:                                                 ; for high mid-range tones 

kamp1   linseg  0, iatt, 0.023, iatt, 0.062, iatt, 0.140, iatt,         \ 
0.605, iatt, 0.902, iatt, 1.302, isus, 1.355, isus, 1.355, isus,        \
1.202, isus, 0.934, idec, 0.891, idec, 0.654, idec, 0.225, idec,        \
0.000, idec, -0.012, idec, 0
kamp2   linseg  0, iatt, 0.035, iatt, 0.230, iatt, 0.637, iatt, .410,   \
iatt, 0.279, iatt, -.240, isus, -0.259, isus, -0.248, isus, -0.086,     \
isus, -0.090, idec, -0.109, idec, -0.074, idec, -0.037, idec, 0.000,    \
idec, 0.016, idec, 0
kamp3   linseg  0, iatt, -0.070, iatt, -0.144, iatt, -0.167, iatt,      \
-.230, iatt, -.350, iatt, -.500, isus, -0.650, isus, -0.435, isus,      \
-0.083, isus, 0.009, idec, 0.030, idec, 0.485, idec, 1.477, idec,       \
1.000, idec, 0.278, idec, 0
iwt1    =       89
iwt2    =       90
iwt3    =       91
inorm   =       19174.7
goto end

range4:                                                 ; for high range tones 

kamp1   linseg  0, iatt, 0.015, iatt, 0.000, iatt, 0.504, iatt,         \
0.294, iatt, 0.334, iatt, 0.000, isus, 0.580, isus, 1.166, isus,        \
1.017, isus, 0.996, idec, 1.015, idec, 0.308, idec, 0.002, idec,        \
0.010, idec, -0.005, idec, 0
kamp2   linseg  0, iatt, 0.115, iatt, 1.000, iatt, 0.567, iatt,         \
0.275, iatt, -0.427, iatt, 0.000, isus, -1.425, isus, -1.222, isus,     \
-0.760, isus, -0.270, idec, -0.026, idec, 1.483, idec, 1.819, idec,     \
0.549, idec, 0.188, idec, 0
kamp3   linseg  0, iatt, -0.002, iatt, 0.000, iatt, -0.020, iatt,       \
0.519, iatt, 0.743, iatt, 1.000, isus, 0.853, isus, 0.365, isus,        \
0.371, isus, 0.110, idec, -0.004, idec, 0.185, idec, 0.011, idec,       \
0.001, idec, 0.003, idec, 0
iwt1    =       92
iwt2    =       93
iwt3    =       94
inorm   =       27370.2
goto end

range5:                                                 ; for high range tones 

kamp1   linseg  0, iatt, 0.015, iatt, 0.000, iatt, 0.504, iatt,         \
0.294, iatt, 0.334, iatt, 0.000, isus, 0.580, isus, 1.166, isus,        \
1.017, isus, 0.996, idec, 1.015, idec, 0.308, idec, 0.002, idec,        \
0.010, idec, -0.005, idec, 0
kamp2   linseg  0, iatt, 0.115, iatt, 1.000, iatt, 0.567, iatt,         \
0.275, iatt, -0.427, iatt, 0.000, isus, -1.425, isus, -1.222, isus,     \
-0.760, isus, -0.270, idec, -0.026, idec, 1.483, idec, 1.819, idec,     \
0.549, idec, 0.188, idec, 0
kamp3   linseg  0, iatt, -0.002, iatt, 0.000, iatt, -0.020, iatt,       \
0.519, iatt, 0.743, iatt, 1.000, isus, 0.853, isus, 0.365, isus,        \
0.371, isus, 0.110, idec, -0.004, idec, 0.185, idec, 0.011, idec,       \
0.001, idec, 0.003, idec, 0
iwt1    =       95
iwt2    =       96
iwt3    =       97
inorm   =       22329.4
goto end

end:
kampr1  randi   .02*kamp1, 10, giseed                   ; up to 2% wavetable amplitude variation
giseed  =       frac(giseed*105.947)
kamp1   =       kamp1 + kampr1
kampr2  randi   .02*kamp2, 10, giseed                   ; up to 2% wavetable amplitude variation
giseed  =       frac(giseed*105.947)
kamp2   =       kamp2 + kampr2
kampr3  randi   .02*kamp3, 10, giseed                   ; up to 2% wavetable amplitude variation
giseed  =       frac(giseed*105.947)
kamp3   =       kamp3 + kampr3

awt1    oscili  kamp1, kfreq, iwt1, iphase              ; wavetable lookup
awt2    oscili  kamp2, kfreq, iwt2, iphase
awt3    oscili  kamp3, kfreq, iwt3, iphase
asig    =       awt1 + awt2 + awt3
asig    =       asig*(iampscale/inorm)
kcut    linseg  0, iattack, ifiltcut, isustain, ifiltcut, idecay, 0     ; lowpass filter for brightness control
afilt   tone    asig, kcut
asig    balance afilt, asig
garev   =       garev + asig
        outs    asig,asig
        endin

;--------------------------------------------------

instr 194                                                              
; add reverb to global signal garev
;       parameters
;       p4      starting reverb time
;       p5      final reverb time
;       p6      % of reverb relative to source signal

irevtime        = p4                                                    ; set first duration of reverb time
ichngtime       = p5                                                    ; set final duration of reverb time
iring           = 0
iring           = (irevtime > ichngtime ? irevtime : iring)             ; set iring to the starting or ending
iring           = (ichngtime > irevtime ? ichngtime : iring)            ; reverbime, whichever is longer

ireverb         = p6                                                    ; percent for reverberated signal
idur            = p3                                                    ; set the duration at p3, and then
p3              = p3 + iring                                            ; lengthen p3 to include longer reverb time
krevtime        linseg  irevtime, idur, irevtime, iring, ichngtime      ; change duration of reverb time
arev            reverb  garev, krevtime                                 ; add reverb to the global signal
                outs    ireverb * arev, ireverb * arev                  ; output reverberated signal
garev =         0                                                       ; set garev to 0 to prevent feedback
                endin

</CsInstruments>
<CsScore>
; bassclar.sco
; Stravinsky - The Rite of Spring 

; bass clarinet solo in opening after marking 6

f1 0 4097 10 1 

f2 0 16 -2 40 40 80 160 320 640 1280 2560 5120 10240 10240

f83 0 4097 -10 5321 43 5458 112 7869 166 2338 211 5575 104 3280 127 
1184 296 1290 742 419 238 248 481 605 585 619 691 93 242 762 826 831  
830 440 62 286 310 409 200 422 101 170 51 177 44 114 93 27 26 48 80 
98 61 69 45 31 13 7 11 33 0 38 21 11 

f84 0 4097 -10 2390 251 2895 266 1251 148 358 146 300 93 81 65 50 20  
28 3 19 2 8 12 60 38 39 61 9 34 25 42 37 6  

f85 0 4097 -10 4231 54 3544 101 4989 146 1459 122 3251 157 1310 147  
779 6 1326 396 720 235 238 260 516 123 519 45 36 112 320 112 253 83  
216 62 107 52 94 126 32 49 33 35 32 32 15 14 

f86 0 4097 -10 6317 51 6402 115 4155 81 1130 67 609 372 1333 427 1708  
490 1817 798 2287 553 1410 385 421 208 448 70 347 146 753 482 572 119  
222 101 158 216 75 155 67 14 27 38 74 3 61 105 109 71 34 12 14 27 15  
23 28 46 24 35 13 10 27 7 42 33 44 24 56 50 53 13  

f87 0 4097 -10 3464 54 4267 457 84 217 49 29 21 48 38 27 16 21 65 34  
224 461 312 102 

f88 0 4097 -10 1516 179 890 59 566 60 257 17 94 39 172 44 40 41 77 10 

f89 0 4097 -10 10317 51 3402 115 3855 81 2130 67 1009 872 1233 427  
1208 490 1217 398 1187 153 710 285 261 28 278 10 277 26 153 92 82 9  
22 11 28 26 15 25 7 

f90 0 4097 -10 3464 54 2267 257 44 117 29 29 21  

f91 0 4097 -10 1516 179 990 59 266 60 157 17 94 39  

f92 0 4097 -10 14794 31 882 197 3524 218 3723 61 2540 1574 1262 333  
689 395 602 165 85 265 147 22 119 149 28 61 17 69 100 26 143 46 118  
65 12   

f93 0 4097 -10 3278 18 70 4 39 10 16 5 12 57 7 13 11 12 9 

f94 0 4097 -10 16146 44 1093 292 4965 1047 6341 28 4423 760 1292 1316  
659 1498 421 535 116 482 103 38 134 274 265 47 65 59 142 15 75 84 70  
78 12 

f95 0 4097 -10 14794 31 882 197 3524 218 1823 61 1540 774 662 233 289  
195 152 65 45 12  

f96 0 4097 -10 3278 18 70 4 39 10   

f97 0 4097 -10 16146 44 1093 292 2965 1047 3341 128 2423 760 392 316  
159 148 61 45 26

t 0 66

;p1     p2      p3      p4      p5      p6      p7      p8      p9
;       start   dur     amp     Hertz   vibr    att     dec     bright
;pickup at score marking 6-----------------------------------------------
i15     1.340   0.150   25000   81.750  0.000   0.050   0.050   9
i15     1.440   0.230   25000   93.013  0.000   0.050   0.100   9
i15     1.670   0.330   25000   93.013  0.000   0.050   0.200   9
;bar 1 of solo-----------------------------------------------------------
i15     2.000   0.150   25000   81.750  0.000   0.050   0.050   9
i15     2.100   0.150   25000   93.013  0.000   0.050   0.050   9
i15     2.200   0.200   25000   93.013  0.000   0.050   0.050   9
i15     2.400   0.200   25000   93.013  0.000   0.050   0.050   9
i15     2.600   0.200   25000   93.013  0.000   0.050   0.050   9
i15     2.800   0.200   25000   93.013  0.000   0.050   0.050   9
i15     3.000   0.200   25000   93.013  0.000   0.050   0.050   9
i15     3.125   0.200   25000   109.000 0.000   0.050   0.050   9
i15     3.250   0.200   25000   163.500 0.000   0.050   0.050   9
i15     3.375   0.200   25000   209.280 0.000   0.050   0.050   9
i15     3.500   0.200   25000   186.027 0.000   0.050   0.050   9
i15     3.625   0.200   25000   261.600 0.000   0.050   0.050   9
i15     3.750   0.200   25000   163.500 0.000   0.050   0.050   9
i15     3.875   0.200   25000   109.000 0.000   0.050   0.050   9
;bar 2 of solo-----------------------------------------------------------
i15     4.000   0.500   25000   93.013  0.000   0.050   0.350   9
i15     4.500   0.150   25000   81.750  0.000   0.050   0.050   9
i15     4.600   0.625   25000   93.013  0.000   0.050   0.350   9
i15     5.125   0.200   25000   109.000 0.000   0.050   0.050   9
i15     5.250   0.200   25000   163.500 0.000   0.050   0.050   9
i15     5.375   0.200   25000   209.280 0.000   0.050   0.050   9
i15     5.500   0.200   25000   186.027 0.000   0.050   0.050   9
i15     5.625   0.200   25000   261.600 0.000   0.050   0.050   9
i15     5.750   0.200   25000   163.500 0.000   0.050   0.050   9
i15     5.875   0.200   25000   109.000 0.000   0.050   0.050   9
;bar 3 of solo-----------------------------------------------------------
i15     6.000   0.200   25000   93.013  0.000   0.050   0.050   9
i15     6.125   0.200   25000   109.000 0.000   0.050   0.050   9
i15     6.250   0.200   25000   163.500 0.000   0.050   0.050   9
i15     6.375   0.200   25000   209.280 0.000   0.050   0.050   9
i15     6.500   0.200   25000   186.027 0.000   0.050   0.050   9
i15     6.625   0.200   25000   261.600 0.000   0.050   0.050   9
i15     6.750   0.200   25000   163.500 0.000   0.050   0.050   9
i15     6.875   0.200   25000   109.000 0.000   0.050   0.050   9
i15     7.000   0.300   25000   93.013  0.000   0.050   0.100   9
i15     7.250   0.150   25000   81.750  0.000   0.050   0.050   9
i15     7.350   0.150   25000   93.013  0.000   0.050   0.050   9
i15     7.500   0.250   25000   93.013  0.000   0.050   0.100   9
i15     7.750   0.250   25000   93.013  0.000   0.050   0.100   9

;reverb------------------------------------------------------------------
;p1     p2      p3      p4      p5      p6
;                       start   final   percent
;       start   dur     revtime revtime reverb
i194    0       8       1.1     .5      .05

e

</CsScore>
</CsoundSynthesizer>
<MacOptions>
Version: 3
Render: Real
Ask: Yes
Functions: ioObject
Listing: Window
WindowBounds: 950 62 400 150
CurrentView: io
IOViewEdit: On
Options:
</MacOptions>

<MacGUI>
ioView nobackground {65535, 65535, 65535}
ioSlider {5, 5} {20, 100} 0.000000 1.000000 0.000000 slider1
ioSlider {45, 5} {20, 100} 0.000000 1.000000 0.000000 slider2
ioSlider {85, 5} {20, 100} 0.000000 1.000000 0.000000 slider3
ioSlider {125, 5} {20, 100} 0.000000 1.000000 0.000000 slider4
ioSlider {165, 5} {20, 100} 0.000000 1.000000 0.000000 slider5
</MacGUI>

