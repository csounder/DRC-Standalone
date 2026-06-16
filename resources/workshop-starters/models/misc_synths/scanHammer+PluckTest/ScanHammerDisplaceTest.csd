<CsoundSynthesizer>
<CsInstruments>
sr=44100
ksmps=32
nchnls=2
0dbfs  = 1

instr scan ;
a0 init 0


irate = .04
kmass line 2,p3,1
kstiff line 10,p3,10
kcenter line 5,p3,6
kdamp line 1,p3,2
kpos line .4,p3,.5
kdisp line .01,p3,.02

;scanu2 init,irate,ifndisplace,ifnmass,ifnmatrix,ifncentr,ifndamp,kmass,kmtrxstiff,
; kcentr, kdamp, ileft, iright, kpos, kdisplace, ain, idisp, id
scanu2 p6, irate, 6, 2, 3, 4, 5, kmass, kstiff, kcenter, kdamp, p8, p9, kpos, p7, a0, 1, 2
;ar scans kamp, kfreq, ifntraj, id
a1 scans ampdbfs(p4), cpspch(p5), 7, 2
a1 dcblock2 a1
outs a1, a1
endin
</CsInstruments>
<CsScore>
f1 0 16 10 1          ; Sine Hammer
f11 0 16 10 1 .5 .3 .2 .1 .01 ; Sawlike hammer
f111 0 16 10 1 0 .73 0 .53 0 .45 0 .17 0 .02 0 .002 ; Pulselike hammer
f2 0 16 -7 8 16 8     ; Masses
f3 0 0 -44 "string_with_extras-16.matrxT.txt"   ; Spring matrices
f4 0 16 -7 .07 16 .07 ; Centering force, uniform initial centering
f5 0 16 -7 .04 16 .04 ; Damping, uniform damping
f6 0 16 -7 .01 16 .01 ; uniform initial velocity-displacement
f7 0 16 -5 15 16 1    ; Trajectories

i"scan" 0 3 -6 7.00 -1  .02  .5 .5  ; pluck in middle 
s
i"scan" 0 3 -6 7.00 -1  .02  .1 .1  ; pluck at left
s
i"scan" 0 3 -6 7.00 -1  .02  .2 -.8  ; 2plucks up left and down right
s
i"scan" 0 3 -6 7.00 1   .02  .2 .8  ; sine hammer - ignore pluck position   
s
i"scan" 0 3 -6 7.00 11  .02  .8 .2  ; sawlike hammer - ignore pluck position 
s
i"scan" 0 3 -6 7.00 111 .02 .1 .6   ; pulselike hammer - ignore pluck position 
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
 <bsbObject version="2" type="BSBScope">
  <objectName/>
  <x>1</x>
  <y>1</y>
  <width>610</width>
  <height>268</height>
  <uuid>{5016f89d-0e36-4dd9-a796-43685bb55af6}</uuid>
  <visible>true</visible>
  <midichan>0</midichan>
  <midicc>-3</midicc>
  <description/>
  <value>-255.00000000</value>
  <type>scope</type>
  <zoomx>2.00000000</zoomx>
  <zoomy>1.00000000</zoomy>
  <dispx>1.00000000</dispx>
  <dispy>1.00000000</dispy>
  <mode>0.00000000</mode>
  <triggermode>NoTrigger</triggermode>
 </bsbObject>
 <bsbObject version="2" type="BSBGraph">
  <objectName/>
  <x>1</x>
  <y>274</y>
  <width>609</width>
  <height>281</height>
  <uuid>{e77ff619-7337-46f3-9d69-346c896545de}</uuid>
  <visible>true</visible>
  <midichan>0</midichan>
  <midicc>-3</midicc>
  <description/>
  <value>8</value>
  <objectName2/>
  <zoomx>1.00000000</zoomx>
  <zoomy>1.00000000</zoomy>
  <dispx>1.00000000</dispx>
  <dispy>1.00000000</dispy>
  <modex>lin</modex>
  <modey>lin</modey>
  <showSelector>true</showSelector>
  <showGrid>true</showGrid>
  <showTableInfo>true</showTableInfo>
  <showScrollbars>true</showScrollbars>
  <enableTables>true</enableTables>
  <enableDisplays>true</enableDisplays>
  <all>true</all>
 </bsbObject>
</bsbPanel>
<bsbPresets>
</bsbPresets>
