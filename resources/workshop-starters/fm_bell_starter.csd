<CsoundSynthesizer>
<CsOptions>
-n -d -m0 -o /tmp/lac-fm-bell.wav
</CsOptions>
<CsInstruments>
sr = 44100
ksmps = 64
nchnls = 2
0dbfs = 1

giSine ftgen 1, 0, 4096, 10, 1

instr 1
  iFreq = cpsmidinn(p4)
  iAmp  = p5
  kEnv  linsegr 0, 0.005, 1, p3 - 0.01, 0.001, 0.005, 0
  kIdx  linsegr 9, 0.02, 9, p3 * 0.25, 2, p3 * 0.75 - 0.02, 0.2
  aSig  foscili kEnv, iFreq, 1, 3.51, kIdx, giSine
  aL, aR reverbsc aSig * iAmp, aSig * iAmp, 0.84, 9000
  out(aL, aR)
endin
</CsInstruments>
<CsScore>
i 1 0.00 0.40 60 0.22
i 1 0.40 0.40 62 0.22
i 1 0.80 0.40 64 0.22
i 1 1.20 0.40 67 0.22
i 1 1.60 0.40 72 0.24
i 1 2.20 0.30 60 0.24
i 1 2.50 0.30 64 0.24
i 1 2.80 0.30 67 0.24
i 1 3.10 0.30 71 0.24
i 1 3.60 0.18 67 0.20
i 1 3.78 0.18 64 0.20
i 1 3.96 0.18 67 0.20
i 1 4.14 0.18 72 0.20
i 1 4.80 1.80 60 0.18
i 1 4.80 1.80 64 0.16
i 1 4.80 1.80 67 0.14
i 1 4.80 1.80 72 0.12
</CsScore>
</CsoundSynthesizer>
