/* G-BIOS 0.1.0: educational, parameterized electric-thruster model. No hardware interface. */
(function (root) {
  'use strict';
  const MIN_HZ = 12;
  const MAX_HZ = 88;
  const DRY_MASS_KG = 5000;
  const PROPELLANT_KG = 100;
  const EXHAUST_VELOCITY_M_S = 20000;
  const EFFICIENCY = 0.62; // illustrative, not verified for a particular thruster
  const PIEZO_RECOVERY = 0.12; // illustrative fraction of actuator mechanical input
  const AMBIENT_C = 24;
  const MAX_C = 85; // illustrative thermal trip threshold, not a hardware rating

  function clamp(x, min, max) {
    const n = Number(x);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function computeCycle(input) {
    const active = Boolean(input.active) && !Boolean(input.fault);
    const powerW = clamp(input.powerW, 1000, 50000);
    const signal = clamp(input.bassLevel, 0, 1);
    const sensitivity = clamp(input.sensitivity, 0.2, 2);
    const frequencyHz = Number(input.frequencyHz);
    const bandOk = Number.isFinite(frequencyHz) && frequencyHz >= MIN_HZ && frequencyHz <= MAX_HZ;
    const tempC = clamp(input.tempC, -100, 500);
    const propellantKg = clamp(input.propellantKg, 0, PROPELLANT_KG);
    const enabled = active && bandOk && tempC < MAX_C && propellantKg > 0;
    const throttle = enabled ? clamp(signal * sensitivity, 0, 1) : 0;
    const controlW = active ? powerW * 0.02 : 0;
    const acousticW = enabled ? powerW * 0.06 * signal : 0;
    const recoveredW = acousticW * PIEZO_RECOVERY;
    // Recovery reduces gross input loss, it cannot create energy.
    const thrusterAvailableW = Math.max(0, powerW - controlW - acousticW + recoveredW);
    const thrusterInputW = enabled ? thrusterAvailableW * throttle : 0;
    const busDrawW = controlW + acousticW + thrusterInputW - recoveredW;
    const jetPowerW = thrusterInputW * EFFICIENCY;
    // P_jet = 0.5 * mdot * v_e^2; F = mdot * v_e (idealized).
    const massFlowKgS = 2 * jetPowerW / (EXHAUST_VELOCITY_M_S ** 2);
    const thrustN = massFlowKgS * EXHAUST_VELOCITY_M_S;
    return {
      active, enabled, bandOk, frequencyHz, signal, throttle, powerW,
      controlW, acousticW, recoveredW, thrusterInputW, busDrawW,
      jetPowerW, massFlowKgS, thrustN,
      exhaustVelocityMS: EXHAUST_VELOCITY_M_S,
      efficiency: EFFICIENCY,
      energyBalanceValid: busDrawW <= powerW + 1e-8 && recoveredW <= acousticW + 1e-8
    };
  }

  function advanceState(previous, cycle, deltaSeconds) {
    const dt = clamp(deltaSeconds, 0, 0.1);
    const propellantOld = clamp(previous.propellantKg, 0, PROPELLANT_KG);
    const burnKg = Math.min(propellantOld, cycle.massFlowKgS * dt);
    const massKg = DRY_MASS_KG + propellantOld;
    const accelerationMS2 = massKg > 0 ? cycle.thrustN / massKg : 0;
    const tempOld = Number.isFinite(previous.tempC) ? previous.tempC : AMBIENT_C;
    // Demonstration-only lumped thermal model. Not predictive of real equipment.
    const heating = cycle.busDrawW * 0.0001;
    const cooling = (tempOld - AMBIENT_C) * 0.06;
    const tempC = Math.max(AMBIENT_C, tempOld + (heating - cooling) * dt);
    const fault = Boolean(previous.fault) || tempC >= MAX_C;
    return {
      timeS: (previous.timeS || 0) + dt,
      tempC,
      propellantKg: Math.max(0, propellantOld - burnKg),
      propellantUsedKg: PROPELLANT_KG - Math.max(0, propellantOld - burnKg),
      speedMS: (previous.speedMS || 0) + accelerationMS2 * dt,
      accelerationMS2,
      fault
    };
  }

  function newState() {
    return {
      timeS: 0, tempC: AMBIENT_C, propellantKg: PROPELLANT_KG,
      propellantUsedKg: 0, speedMS: 0, accelerationMS2: 0, fault: false
    };
  }

  root.GBIOS = Object.freeze({
    VERSION: '0.1.0', MIN_HZ, MAX_HZ, DRY_MASS_KG, PROPELLANT_KG,
    EXHAUST_VELOCITY_M_S, EFFICIENCY, MAX_C,
    clamp, computeCycle, advanceState, newState
  });
})(typeof globalThis === 'object' ? globalThis : this);