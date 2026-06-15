<CsoundSynthesizer>
<CsOptions>
-odac -d
</CsOptions>
<CsInstruments>
sr = 44100
ksmps = 64
nchnls = 2
0dbfs = 1

giSine ftgen 1, 0, 4096, 10, 1

chn_k "amplitude", 3, 2, 0.5, 0, 1, 0, 0, 0, 0, "unit= label=Amplitude"
chn_k "attack", 3, 3, 0.01, 0.001, 2, 0, 0, 0, 0, "unit=s label=Attack"
chn_k "release", 3, 3, 0.5, 0.01, 6, 0, 0, 0, 0, "unit=s label=Release"
chn_k "fmIndex", 3, 2, 9, 0, 30, 0, 0, 0, 0, "unit= label=FM_Index"
chn_k "reverbMix", 3, 2, 0.35, 0, 1, 0, 0, 0, 0, "unit= label=Reverb_Mix"
chn_k "reverbSize", 3, 2, 0.85, 0, 1, 0, 0, 0, 0, "unit= label=Reverb_Size"

chnset 0.5, "amplitude"
chnset 0.01, "attack"
chnset 0.5, "release"
chnset 9, "fmIndex"
chnset 0.35, "reverbMix"
chnset 0.85, "reverbSize"

instr 1
  iAtt  chnget "attack"
  iRel  chnget "release"
  kAmp  chnget "amplitude"
  kIdx  chnget "fmIndex"
  kAmp  port kAmp, 0.02
  kIdx  port kIdx, 0.02
  kEnv  linsegr 0, iAtt, 1, iAtt + 0.05, 0.7, iRel, 0
  iVel  = p5
  aSig  foscili kEnv * kAmp * iVel, p4, 1, 3.51, kIdx, giSine
  chnmix aSig, "revL"
  chnmix aSig, "revR"
  outs aSig, aSig
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
  aL, aR reverbsc aInL, aInR, kSize, 12000
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
