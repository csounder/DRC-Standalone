<CsoundSynthesizer>
<CsOptions>
-o dac
-d
--limiter=0.9
</CsOptions>
<CsInstruments>
sr = 44100
ksmps = 64
nchnls = 2
0dbfs = 1

giSine ftgen 0, 0, 8192, 10, 1
giPart ftgen 0, 0, 8192, 9, 1, 1, 90

chn_k "amplitude", 3, 2, 0.6, 0, 1, 0, 0, 0, 0, "unit= label=Amplitude"
chn_k "attack", 3, 3, 0.01, 0.001, 1, 0, 0, 0, 0, "unit=s label=Attack"
chn_k "release", 3, 3, 1.5, 0.05, 6, 0, 0, 0, 0, "unit=s label=Release"
chn_k "filterStart", 3, 3, 7600, 200, 20000, 0, 0, 0, 0, "unit=Hz label=Filter_Start"
chn_k "filterEnd", 3, 3, 300, 50, 8000, 0, 0, 0, 0, "unit=Hz label=Filter_End"
chn_k "bandwidth", 3, 2, 133, 20, 500, 0, 0, 0, 0, "unit= label=Bandwidth"
chn_k "reverbMix", 3, 2, 0.4, 0, 1, 0, 0, 0, 0, "unit= label=Reverb_Mix"
chn_k "reverbSize", 3, 2, 0.9, 0.3, 1, 0, 0, 0, 0, "unit= label=Reverb_Size"

chnset 0.6, "amplitude"
chnset 0.01, "attack"
chnset 1.5, "release"
chnset 7600, "filterStart"
chnset 300, "filterEnd"
chnset 133, "bandwidth"
chnset 0.4, "reverbMix"
chnset 0.9, "reverbSize"

instr 1
  iAtt  chnget "attack"
  iRel  chnget "release"
  kAmp  chnget "amplitude"
  iF0   chnget "filterStart"
  iF1   chnget "filterEnd"
  kBw   chnget "bandwidth"
  kAmp  port kAmp, 0.02
  kBw   port kBw, 0.02
  kEnv  linsegr 0, iAtt, 1, iAtt * 0.01, 0.9, iRel, 0
  iVel  = p5
  k1    expon iF0, iAtt + iRel, iF1
  anoise rand 8000
  a1    reson anoise, k1, k1 / kBw, 1
  k2    oscil 0.6, 11.3, giSine, 0.1
  a2    oscil kEnv * kAmp * iVel, p4 + k2, giPart
  aOutL = (a1 * 0.8) + a2
  aOutR = (a1 * 0.6) + (a2 * 0.7)
  chnmix a2 * 0.6, "revL"
  chnmix a2 * 0.6, "revR"
  outs aOutL, aOutR
endin

instr 100
  Schan strget p4
  iVal  = p5
  chnset iVal, Schan
  turnoff
endin

instr 99
  kMix  chnget "reverbMix"
  kSize chnget "reverbSize"
  aInL  chnget "revL"
  aInR  chnget "revR"
  aL, aR reverbsc aInL, aInR, kSize, 9000
  outs  aL * kMix, aR * kMix
  chnclear "revL"
  chnclear "revR"
endin
</CsInstruments>
<CsScore>
i 99 0 36000
f 0 36000
</CsScore>
</CsoundSynthesizer>
