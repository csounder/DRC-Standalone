<CsoundSynthesizer>
<CsOptions>
-n -d -m0 -o /tmp/lac-fm.wav
</CsOptions>
<CsInstruments>
sr = 44100
ksmps = 32
nchnls = 2
0dbfs = 1
seed 0

giSine ftgen 0, 0, 4096, 10, 1

instr 1
  iFreq = cpsmidinn(p4)
  iAmp  = p5
  kCar  = 440
  kMod  = 220
  kIdx  = 4
  aCar  foscili iAmp, kCar, 1, kMod, kIdx
  kEnv  linsegr 0, 0.01, 1, p3 - 0.02, 0.8, 0.01, 0
  out(aCar * kEnv, aCar * kEnv)
endin
</CsInstruments>
<CsScore>
i 1 0 3 60 0.3
</CsScore>
</CsoundSynthesizer>
