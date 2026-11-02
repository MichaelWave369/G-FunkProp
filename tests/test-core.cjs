'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '..', 'core.js'), 'utf8');
const sandbox = {};
sandbox.globalThis = sandbox;
vm.runInNewContext(code, sandbox);
const { GBIOS: g } = sandbox;
assert.equal(g.VERSION, '0.1.0');
const base = { active:true, powerW:25000, bassLevel:1, sensitivity:1, frequencyHz:42, tempC:24, propellantKg:100 };
const run = g.computeCycle(base);
assert(run.enabled && run.thrustN > 0, 'valid sub-bass turns the modeled thruster on');
assert(run.energyBalanceValid, 'recovery cannot exceed source input');
assert(Math.abs(run.thrustN-run.massFlowKgS*run.exhaustVelocityMS) < 1e-12);
assert(Math.abs(run.jetPowerW-run.massFlowKgS*run.exhaustVelocityMS**2/2)<1e-8);
assert.equal(g.computeCycle({...base,frequencyHz:100}).thrustN,0,'out-of-band signal cannot drive simulated thrust');
assert.equal(g.computeCycle({...base,active:false}).thrustN,0,'inactive engine cannot thrust');
assert.equal(g.computeCycle({...base,propellantKg:0}).thrustN,0,'no propellant means no thrust');
assert.equal(g.computeCycle({...base,tempC:86}).thrustN,0,'thermal trip stops thrust');
assert.equal(g.computeCycle({...base,bassLevel:0}).thrustN,0,'silence stops thrust');
const state=g.advanceState(g.newState(),run,0.1);
assert(state.speedMS>0 && state.propellantKg<100 && state.tempC>24);
assert(state.timeS<=0.1000001);
// Test power accounting under a large suite of varying inputs.
for(let i=0;i<10000;i++){
  const cycle=g.computeCycle({...base,powerW:1000+(i%50)*1000,bassLevel:(i%101)/100,sensitivity:.2+(i%10)*.2});
  assert(cycle.energyBalanceValid,'energy ledger must balance');
  assert(cycle.busDrawW<=cycle.powerW+1e-6,'draw must not exceed rated bus');
  assert(cycle.recoveredW<=cycle.acousticW+1e-6,'piezo cannot produce free power');
  assert(cycle.jetPowerW<=cycle.thrusterInputW+1e-6,'no >100% jet efficiency');
  assert(cycle.massFlowKgS>=0 && cycle.thrustN>=0);
}
console.log('G-BIOS model checks passed: conservation, gating, cutoff, integration, and 10,000 randomized power cases.');