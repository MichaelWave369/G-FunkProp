/* G-BIOS experiment bench: deterministic sweeps of the illustrative math model.
 * Not microphone calibration, DSP frequency-response verification, or hardware data. */
(function (root) {
  'use strict';
  const core = root.GBIOS;
  if (!core) throw new Error('Load core.js before bench.js');

  const MODES = Object.freeze({
    frequency: Object.freeze({label:'FREQUENCY GATE', unit:'Hz', start:0, end:110, step:2}),
    power: Object.freeze({label:'ELECTRICAL BUS', unit:'kW', start:1, end:50, step:1}),
    signal: Object.freeze({label:'BASS ENVELOPE', unit:'%', start:0, end:100, step:2})
  });
  function safeNumber(value, fallback, min, max) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max,n)) : fallback;
  }
  function createSweep(mode, options) {
    if (!Object.prototype.hasOwnProperty.call(MODES, mode)) throw new Error('Unknown bench mode');
    const spec = MODES[mode];
    const opts = options || {};
    const powerW = safeNumber(opts.powerW,25000,1000,50000);
    const sensitivity = safeNumber(opts.sensitivity,1,0.2,2);
    const frequencyHz = safeNumber(opts.frequencyHz,42,0,200);
    const bassLevel = safeNumber(opts.bassLevel,0.75,0,1);
    const base = {active:true,fault:false,powerW,bassLevel,sensitivity,frequencyHz,tempC:24,propellantKg:100};
    const points = [];
    for (let x=spec.start;x<=spec.end;x+=spec.step) {
      const input = {...base};
      if (mode==='frequency') input.frequencyHz=x;
      else if (mode==='power') input.powerW=x*1000;
      else input.bassLevel=x/100;
      const cycle = core.computeCycle(input);
      if (!cycle.energyBalanceValid) throw new Error('Power ledger failed at '+x+' '+spec.unit);
      points.push(Object.freeze({
        x, thrustN:cycle.thrustN, busDrawW:cycle.busDrawW,
        jetPowerW:cycle.jetPowerW, piezoRecoveredW:cycle.recoveredW,
        massFlowKgS:cycle.massFlowKgS, bandOk:cycle.bandOk,
        throttle:cycle.throttle
      }));
    }
    return {
      schema:'gbios-bench/v1',
      mode, label:spec.label, xUnit:spec.unit, yUnit:'N',
      assumptions:Object.freeze({...base}),
      points:Object.freeze(points)
    };
  }
  function exportCSV(sweep) {
    if (!sweep || sweep.schema!=='gbios-bench/v1' || !Array.isArray(sweep.points)) throw new Error('Invalid bench data');
    const header='input_'+sweep.xUnit.toLowerCase()+',thrust_N,bus_draw_W,jet_power_W,piezo_recovered_W,mass_flow_kg_s,throttle,frequency_in_band';
    const lines = sweep.points.map(p=>[
      p.x,p.thrustN,p.busDrawW,p.jetPowerW,p.piezoRecoveredW,p.massFlowKgS,p.throttle,p.bandOk
    ].join(','));
    return [header,...lines].join('\n')+'\n';
  }
  root.GBIOSBench = Object.freeze({MODES, createSweep, exportCSV});
})(typeof globalThis === 'object' ? globalThis : this);
