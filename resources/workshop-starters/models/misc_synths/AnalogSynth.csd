<CsoundSynthesizer>
<CsInstruments>

ksmps 	= 		32
nchnls 	= 		2

0dbfs = 32768

gaDelL  init
gaDelR  init

gaRvbL  init
gaRvbR  init

turnon "Reverb"
turnon "Delay"


 ; Steven Cook
 instr    1 ; Synth With 2 VCO's, 2 LFO's, PWM, Glide And Ringmod.
 
 ilevl    = p4 * 32767 ; Level
 inote    = cpspch(p5) ; Pitch
 iport    = .0625      ; Glide Time
 ivco2    = p6         ; VCO2 Offset
 idet     = p7         ; VCO2 Detune
 ivcf1    = p8         ; VCF Freq Start
 ivcf2    = p9         ; VCF Freq End
 irez     = p10        ; VCF Resonance
 iwav1    = p11        ; VCO1 Waveform
 iwav2    = p12        ; VCO2 Waveform
 iwave    = p13        ; LFO Waveform
 irate1   = p14        ; LFO1 Rate
 irate2   = p15        ; LFO2 Rate
 iring    = p16        ; Ringmod Level.
 imaxd    = 1/inote
 
 tigoto   tieinit
 ibegp    = inote
 iprev    = inote
 goto     cont
 
 tieinit:
 ibegp    = iprev
 iprev    = inote
 cont:
 
 k1       linseg  ibegp, iport, inote, abs(p3), inote
 k3       expseg  ivcf1, abs(p3), ivcf2
 k4       linseg  0, .01, ilevl, abs(p3)-.02, ilevl, .01, 0
 
 kpwm1    oscil  .45, irate1, iwave, -1
 kpw1     = kpwm1 + .5
 kpwm2    oscil  .45, irate2, iwave, -1
 kpw2     = kpwm2 + .5
 
 avco1    vco  k4, k1, iwav1, kpw1, 1, imaxd
 avco2    vco  k4, k1*ivco2 + idet, iwav2, kpw2, 1, imaxd
 aring    = avco1*avco2/32767
 
 amix     = (avco1 + avco2)*(1-iring) + aring*iring
 
 avcf     rezzy  amix, k3, irez
 
aSig =     avcf*.5
 
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
f1 0 8192 10 1                         ; Sine
 f2 0 4096 7 0 1024 1 2048 -1 1024 0    ; Triangle
 f3 0 1024 7 1 512 1 0 -1 512 -1        ; Square
 f4 0 4096 -7 0 1024 .5 2048 -.5 1024 0 ; Half Level Tri for Shallow PWM
 f5 0 1024 7 0 1024 0                   ; Constant 0 for No PWM/Sqr/Tri
 
 t 0 480
 
 ; Wave: 1=Saw, 2=Pwm, 3=Saw/Tri/Ramp
 
 ;                    -----VCOs------ ------VCF------ ---VCOs-- ------LFOs------
 ;     Strt Leng Levl Pitch Semi Fine Vcf1  Vcf2  Rez Wav1 Wav2 Wave Rate1 Rate2 Ring
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
 e 55
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
