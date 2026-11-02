# Rung 3 · G-BIOS Experiment Bench

This is a **deterministic model exploration tool**. It is not an acoustic measurement, physical frequency-response test, measured efficiency curve, controller qualification, or an operational spacecraft design.

## Open and use

1. Open the offline `index.html` or the GitHub Pages demo.
2. In **05 / EXPERIMENT → FREQUENCY & POWER BENCH**, choose an experiment.
3. Select **RUN SWEEP** to plot the output of the existing educational `GBIOS.computeCycle()` formula.
4. Use **EXPORT CSV** to save the current data locally, without server calls.

The experiments run without playing audio. Your browser does not need microphone access. The existing DJ engine and its independent E-STOP remain unchanged.

## Experiment definitions

| Mode | X values | Fixed inputs | Intended falsifiable assertion |
| --- | --- | --- | --- |
| Frequency gate | 0–110 Hz, 2 Hz increments | 75% envelope, current bus power and sensitivity | Modeled thrust is zero below 12 Hz and above 88 Hz; modeled gate includes 12 and 88 Hz |
| Electrical bus | 1–50 kW, 1 kW increments | 75% envelope, current tone frequency and sensitivity | Modeled thrust is nondecreasing with bus power when frequency lies in the allowed band |
| Bass envelope | 0–100%, 2% increments | Current bus power, tone frequency and sensitivity | Modeled thrust is nondecreasing with envelope within the allowed frequency band |

Defaults are 25 kW bus, 42 Hz tone frequency, 100% sensitivity. The model assumes 62% jet efficiency, 12% acoustic input recovery, a 20 km/s exhaust velocity, and idealized reaction mass. **None of these assumptions is established by the bench.**

The exported CSV contains the x-value, thrust in newtons, net electrical draw in watts, kinetic exhaust power in watts, recovered piezoelectric power in watts, propellant flow in kg/s, modeled throttle and frequency-band status. There is no metadata or recorded audio in the export. Inputs other than the swept variable remain at the explicitly stated defaults or current control settings.

## Scope and limitations

- These curves test the **software model** in `core.js`, not the real frequency response of any loudspeaker, piezoelectric sample, microphone, acoustic chamber, ion thruster or plasma device.
- The model's hard 12–88 Hz gate is **not** a calibrated Web Audio bandpass filter; the live app currently uses an 88 Hz lowpass and a spectral peak estimate.
- The plotted 0–110 Hz response is a defined numerical gate, not a laboratory-measured acoustic resonance curve.
- Power accounting rejects free-energy claims. The bus supplies all modeled net energy.
- Fictional warp-mode visuals do not affect the bench results.
- No real hardware control, pressure vessel, high voltage or plasma apparatus is involved.

## Developer checks

```sh
node tests/test-core.cjs
node tests/test-bench.cjs
```

Bench runs are deterministic for matching inputs, and the tests check gate boundaries, monotonicity, nonnegative finite values and byte-identical CSV exports.

## Next research questions

The next genuine physics improvement is to **measure** electromechanical conversion efficiency vs. frequency and load in a safe, low-voltage laboratory setup, then import the measured table with provenance and uncertainty bands. Separately, a reproducible DSP test suite with synthesized input signals should establish the live application's detection accuracy before any claim of frequency calibration.
