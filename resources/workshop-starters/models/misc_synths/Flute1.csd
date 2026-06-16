<CsoundSynthesizer>
<CsInstruments>
; flute.orc
; instr 11 - flute
; instr 194 - reverb
sr=44100
kr=441
ksmps=100
nchnls=2

giseed = .5
giwtsin = 1
garev   init    0
;--------------------------------------------------------------------- 

instr 11                                                        ; flute

;       parameters
;       p4      overall amplitude scaling factor
;       p5      pitch in Hertz (normal pitch range: C4-C7)
;       p6      percent vibrato depth, recommended values in range [-1., +1.]
;                       0.0     -> no vibrato
;                       +1.     -> 1% vibrato depth, where vibrato rate increases slightly
;                       -1.     -> 1% vibrato depth, where vibrato rate decreases slightly
;       p7      attack time in seconds 
;                       recommended value:  .12 for slurred notes, .06 for tongued notes 
;                               (.03 for short notes)
;       p8      decay time in seconds 
;                       recommended value:  .1 (.05 for short notes)
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

ifdev1  =       -.03 * giseed                           ; frequency deviation
giseed  =       frac(giseed*105.947)
ifdev2  =       .003 * giseed
giseed  =       frac(giseed*105.947)
ifdev3  =       -.0015 * giseed
giseed  =       frac(giseed*105.947)
ifdev4  =       .012 * giseed
giseed  =       frac(giseed*105.947)
kfreqr  linseg  ifdev1, iattack, ifdev2, isustain, ifdev3, idecay, ifdev4
kfreq   =       ifreq * (1 + kfreqr) + kvib

if ifreq <  427.28 goto range1                          ; (cpspch(8.08) + cpspch(8.09))/2
if ifreq <  608.22 goto range2                          ; (cpspch(9.02) + cpspch(9.03))/2
if ifreq <  1013.7 goto range3                          ; (cpspch(9.11) + cpspch(10.00))/2
goto range4
                                                        ; wavetable amplitude envelopes
range1:                                                 ; for low range tones
kamp1   linseg  0, iatt, 0.002, iatt, 0.045, iatt, 0.146, iatt,  \
0.272, iatt, 0.072, iatt, 0.043, isus, 0.230, isus, 0.000, isus, \
0.118, isus, 0.923, idec, 1.191, idec, 0.794, idec, 0.418, idec, \
0.172, idec, 0.053, idec, 0
kamp2   linseg  0, iatt, 0.009, iatt, 0.022, iatt, -0.049, iatt,  \
-0.120, iatt, 0.297, iatt, 1.890, isus, 1.543, isus, 0.000, isus, \ 
0.546, isus, 0.690, idec, -0.318, idec, -0.326, idec, -0.116, idec, \ 
-0.035, idec, -0.020, idec, 0
kamp3   linseg  0, iatt, 0.005, iatt, -0.026, iatt, 0.023, iatt,    \
0.133, iatt, 0.060, iatt, -1.245, isus, -0.760, isus, 1.000, isus,  \
0.360, isus, -0.526, idec, 0.165, idec, 0.184, idec, 0.060, idec,   \
0.010, idec, 0.013, idec, 0
iwt1    =       26                                      ; wavetable numbers
iwt2    =       27
iwt3    =       28
inorm   =       3949
goto end

range2:                                                 ; for low mid-range tones 

kamp1   linseg  0, iatt, 0.000, iatt, -0.005, iatt, 0.000, iatt, \
0.030, iatt, 0.198, iatt, 0.664, isus, 1.451, isus, 1.782, isus, \ 
1.316, isus, 0.817, idec, 0.284, idec, 0.171, idec, 0.082, idec, \ 
0.037, idec, 0.012, idec, 0
kamp2   linseg  0, iatt, 0.000, iatt, 0.320, iatt, 0.882, iatt,      \
1.863, iatt, 4.175, iatt, 4.355, isus, -5.329, isus, -8.303, isus,   \
-1.480, isus, -0.472, idec, 1.819, idec, -0.135, idec, -0.082, idec, \ 
-0.170, idec, -0.065, idec, 0
kamp3   linseg  0, iatt, 1.000, iatt, 0.520, iatt, -0.303, iatt,     \
0.059, iatt, -4.103, iatt, -6.784, isus, 7.006, isus, 11, isus,      \
12.495, isus, -0.562, idec, -4.946, idec, -0.587, idec, 0.440, idec, \ 
0.174, idec, -0.027, idec, 0
iwt1    =       29
iwt2    =       30
iwt3    =       31
inorm   =       27668.2
goto end

range3:                                                 ; for high mid-range tones 

kamp1   linseg  0, iatt, 0.005, iatt, 0.000, iatt, -0.082, iatt,      \
0.36, iatt, 0.581, iatt, 0.416, isus, 1.073, isus, 0.000, isus,       \
0.356, isus, .86, idec, 0.532, idec, 0.162, idec, 0.076, idec, 0.064, \ 
idec, 0.031, idec, 0
kamp2   linseg  0, iatt, -0.005, iatt, 0.000, iatt, 0.205, iatt,      \
-0.284, iatt, -0.208, iatt, 0.326, isus, -0.401, isus, 1.540, isus,   \
0.589, isus, -0.486, idec, -0.016, idec, 0.141, idec, 0.105, idec,    \
-0.003, idec, -0.023, idec, 0
kamp3   linseg  0, iatt, 0.722, iatt, 1.500, iatt, 3.697, iatt,       \
0.080, iatt, -2.327, iatt, -0.684, isus, -2.638, isus, 0.000, isus,   \
1.347, isus, 0.485, idec, -0.419, idec, -.700, idec, -0.278, idec,    \
0.167, idec, -0.059, idec, 0
iwt1    =       32
iwt2    =       33
iwt3    =       34
inorm   =       3775
goto end

range4:                                                 ; for high range tones 

kamp1   linseg  0, iatt, 0.000, iatt, 0.000, iatt, 0.211, iatt,         \
0.526, iatt, 0.989, iatt, 1.216, isus, 1.727, isus, 1.881, isus,        \
1.462, isus, 1.28, idec, 0.75, idec, 0.34, idec, 0.154, idec, 0.122,    \
idec, 0.028, idec, 0
kamp2   linseg  0, iatt, 0.500, iatt, 0.000, iatt, 0.181, iatt,         \
0.859, iatt, -0.205, iatt, -0.430, isus, -0.725, isus, -0.544, isus,    \
-0.436, isus, -0.109, idec, -0.03, idec, -0.022, idec, -0.046, idec,    \
-0.071, idec, -0.019, idec, 0
kamp3   linseg  0, iatt, 0.000, iatt, 1.000, iatt, 0.426, iatt,         \
0.222, iatt, 0.175, iatt, -0.153, isus, 0.355, isus, 0.175, isus,       \
0.16, isus, -0.246, idec, -0.045, idec, -0.072, idec, 0.057, idec,      \
-0.024, idec, 0.002, idec, 0
iwt1    =       35
iwt2    =       36
iwt3    =       37
inorm   =       4909.05
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
        outs    asig, asig
        endin

;--------------------------------------------------------------------- 

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
; flute.sco
; Debussy - Prelude a l'Apres-midi d'un Faune
; opening flute solo

f1 0 4097 10 1 

f2 0 16 -2 40 40 80 160 320 640 1280 2560 5120 10240 10240

f26 0 4097 -10 2000 489 74 219 125 9 33 5 5 
f27 0 4097 -10 2729 1926 346 662 537 110 61 29 7 
f28 0 4097 -10 2558 2012 390 361 534 139 53 22 10 13 10 

f29 0 4097 -10 12318 8844 1841 1636 256 150 60 46 11 
f30 0 4097 -10 1229 16 34 57 32 
f31 0 4097 -10 163 31 1 50 31 

f32 0 4097 -10 4128 883 354 79 59 23 
f33 0 4097 -10 1924 930 251 50 25 14
f34 0 4097 -10 94 6 22 8 

f35 0 4097 -10 2661 87 33 18 
f36 0 4097 -10 174 12
f37 0 4097 -10 314 13

t 0 84

;p1     p2      p3      p4      p5      p6      p7      p8      p9
;       start   dur     amp     Hertz   vibr    att     dec     bright
;bar 1-------------------------------------------------------------------
i11     1.000   4.700   7000    558.080 1.000   0.230   0.100   5
i11     5.500   0.700   5000    490.500 1.000   0.080   0.100   5
i11     6.000   0.480   5500    470.080 1.000   0.080   0.080   5
i11     6.280   0.530   6000    436.000 1.000   0.080   0.080   5
i11     6.610   0.590   6500    418.560 1.000   0.080   0.080   5
i11     7.000   1.700   7000    392.400 1.000   0.120   0.100   5
i11     8.500   0.660   6500    436.000 1.000   0.080   0.100   5
i11     8.960   0.700   6000    490.500 1.000   0.080   0.100   5
i11     9.460   0.740   5500    523.200 1.000   0.080   0.100   5
;bar 2-------------------------------------------------------------------
i11     10.000  4.700   6000    558.080 1.000   0.160   0.100   5
i11     14.500  0.700   5500    490.500 1.000   0.080   0.100   5
i11     15.000  0.490   6000    470.080 1.000   0.080   0.080   5
i11     15.290  0.530   6500    436.000 1.000   0.080   0.080   5
i11     15.620  0.580   7000    418.560 1.000   0.080   0.080   5
i11     16.000  1.700   7500    392.400 1.000   0.120   0.100   5
i11     17.500  0.670   7000    436.000 1.000   0.080   0.100   5
i11     17.970  0.700   6500    490.500 1.000   0.080   0.100   5
i11     18.470  0.730   6000    523.200 1.000   0.080   0.100   5
;bar 3-------------------------------------------------------------------
i11     19.000  1.160   6500    558.080 1.000   0.120   0.100   5
i11     19.960  1.200   7000    627.840 1.000   0.120   0.100   5
i11     20.960  1.240   7500    837.120 1.000   0.120   0.100   5
i11     22.000  2.150   8000    654.000 1.000   0.140   0.100   5
i11     24.000  1.200   5000    418.560 1.000   0.120   0.100   5
i11     25.000  4.200   7500    490.500 1.000   0.160   0.100   5
;bar 4-------------------------------------------------------------------
i11     29.000  1.150   6500    490.500 1.000   0.120   0.100   5
i11     29.950  1.250   5500    558.080 1.000   0.120   0.100   5
i11     31.000  2.500   4500    470.080 1.000   0.140   0.100   5

;reverb------------------------------------------------------------------
;p1     p2      p3      p4      p5      p6
;                       start   final   percent
;       start   dur     revtime revtime reverb
i194    0       33.5    1.5     1.0     .1

e
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
