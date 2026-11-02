'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sandbox={};sandbox.globalThis=sandbox;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','dsp.js'),'utf8'),sandbox,{filename:'dsp.js'});
const dsp=sandbox.GBIOSDSP;
const sampleRate=48000,length=32768;
function tone(hz,amplitude=.12,phase=0){
  const samples=new Float32Array(length);
  for(let i=0;i<samples.length;i++)samples[i]=amplitude*Math.sin(2*Math.PI*hz*i/sampleRate+phase);
  return samples;
}
function mixed(components){
  const samples=new Float32Array(length);
  for(const [hz,amplitude] of components)for(let i=0;i<length;i++)samples[i]+=amplitude*Math.sin(2*Math.PI*hz*i/sampleRate);
  return samples;
}
assert.equal(dsp.analyze(new Float32Array(1024),sampleRate).detected,false);
assert.equal(dsp.analyze(new Float32Array(length),sampleRate).detected,false);
assert.equal(dsp.analyze(tone(42,.00001),sampleRate).detected,false);
for(const hz of [12,18,42,63,88]){
 const result=dsp.analyze(tone(hz),sampleRate);
 assert(result.detected, 'should detect '+hz+' Hz: '+JSON.stringify(result));
 assert(Math.abs(result.frequencyHz-hz)<1.2,'frequency accuracy '+hz+' Hz: '+result.frequencyHz);
 assert(result.level>0&&result.level<=1);
 assert(result.confidence>=dsp.MIN_CONFIDENCE);
 const repeat=dsp.analyze(tone(hz),sampleRate);
 assert.equal(JSON.stringify(result),JSON.stringify(repeat),'deterministic '+hz+' Hz');
}
for(const hz of [6,9,10,90,95,110]){
 const result=dsp.analyze(tone(hz),sampleRate);
 assert(!result.detected, 'must reject '+hz+' Hz: '+JSON.stringify(result));
 assert.equal(result.level,0);
}
{
 const result=dsp.analyze(mixed([[42,.12],[100,.02]]),sampleRate);
 assert(result.detected && Math.abs(result.frequencyHz-42)<1.2,'strong in-band component should win');
}
{
 const result=dsp.analyze(mixed([[42,.02],[100,.12]]),sampleRate);
 assert(!result.detected,'strong out-of-band component must not be mistaken for in-band');
}
{
 const noisy=new Float32Array(length);let seed=0x1234ABCD;
 for(let i=0;i<noisy.length;i++){
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   noisy[i]=((seed/0xffffffff)*2-1)*.1;
 }
 const out=dsp.analyze(noisy,sampleRate);
 assert(!out.detected, 'broadband noise should not trigger thrust: '+JSON.stringify(out));
}
console.log('G-BIOS DSP checks passed: silence, threshold, 5 in-band tones, 6 excluded tones, mixed signals, deterministic windows, and noise.');
