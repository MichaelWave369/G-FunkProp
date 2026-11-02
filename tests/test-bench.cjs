'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = {console};
root.globalThis = root;
for (const filename of ['core.js','bench.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',filename),'utf8'),root,{filename});
}
const {GBIOSBench: bench} = root;
assert.throws(()=>bench.createSweep('unknown'),/Unknown bench mode/);

for (const mode of ['frequency','power','signal']) {
  const sweep = bench.createSweep(mode);
  assert.equal(sweep.schema,'gbios-bench/v1');
  assert(sweep.points.length >= 40, mode + ': enough points');
  for (const row of sweep.points) {
    assert(Number.isFinite(row.thrustN)&&row.thrustN>=0);
    assert(Number.isFinite(row.busDrawW)&&row.busDrawW>=0);
    assert(row.jetPowerW <= row.busDrawW + 1e-6, 'jet energy stays within drawn electrical power');
    assert(row.piezoRecoveredW>=0);
  }
  const csv = bench.exportCSV(sweep);
  assert.equal(csv.trim().split('\n').length,sweep.points.length+1);
  assert(csv.includes('thrust_N'));
  assert.equal(csv,bench.exportCSV(bench.createSweep(mode)),mode+': deterministic export');
}

const frequency=bench.createSweep('frequency');
const at=f=>frequency.points.find(x=>x.x===f);
assert.equal(at(10).thrustN,0,'below 12 Hz must not thrust');
assert(at(12).thrustN>0,'12 Hz gate included');
assert(at(88).thrustN>0,'88 Hz gate included');
assert.equal(at(90).thrustN,0,'above 88 Hz must not thrust');

for (const mode of ['power','signal']) {
  const pts=bench.createSweep(mode).points;
  for(let i=1;i<pts.length;i++){
    assert(pts[i].thrustN + 1e-9 >= pts[i-1].thrustN,mode+': thrust monotonic');
  }
}
const noSignal=bench.createSweep('signal').points[0];
assert.equal(noSignal.thrustN,0);
assert.equal(bench.createSweep('frequency',{frequencyHz:55,powerW:1000}).points.find(p=>p.x===42).busDrawW<=1000,true);
console.log('G-BIOS bench tests passed: deterministic sweeps, gates, monotonic response, power ledger, and CSV.');
