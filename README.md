# G-Funk Powered Propulsion / G-BIOS 0.1.0

**An offline, MIT-licensed audio-responsive electric-propulsion simulator.** Inspired by a playful three-phase spaceship engine concept: acoustic resonance, piezoelectric transduction, and a gravitational "metric cap."

## Browser demo (GitHub Pages)

The flight deck can be published at **https://michaelwave369.github.io/G-FunkProp/** after GitHub Pages is enabled. Until a successful deployment, treat this as the expected address, not a confirmed live link. The simulator will continue to run offline from `index.html`.

A dedicated [Pages workflow](.github/workflows/pages.yml) validates the model and deploys only `index.html`, `styles.css`, `core.js` and `app.js` from `main`. The workflow uses GitHub Actions, not Netlify. See [Pages launch instructions](docs/PAGES-LAUNCH.md) for the one-time repository setting and deployment checks.

## Launch

Double-click `index.html`. No server, packages, accounts, build system, cloud connection or installation required. Chrome, Edge, and other modern Web Audio-capable browsers are recommended. Use the **ENGAGE THE GROOVE** button to start the original sub-bass tone (the browser requires a user gesture). Keep speaker volume low initially.

To drive the simulated engine with your own music, select **AUDIO FILE**, choose a local sound file, and engage. The file stays in your browser and is never uploaded. Use **E-STOP** to halt the simulated thrust. **RESET** clears the model's elapsed time, velocity, remaining fuel and temperature.

## What's real and what's fiction?

| Stage | Simulator implementation | Reality check |
| --- | --- | --- |
| 1. Acoustic gate | Web Audio lowpass analysis (12–88 Hz), envelope modulation and a tunable original oscillator | Real DSP. Audio is a *control signal*, not propulsive energy |
| 2. Piezo loop | Illustrative 12% recovery of mechanical actuation input, paid back into the bus ledger | Piezoelectric conversion is real, but this recovery fraction is hypothetical |
| 3. Electric thruster | Energy-accounted, idealized reaction-mass model with `P_jet=0.5 mdot v_e²`, `F=mdot v_e` | Based on physical principles, **not** a validated electric-thruster design |
| Metric warp lore | Animated visualization and arbitrary `0–4.20` fictional index | No physical warp field is computed or generated; FTL is not demonstrated |

The bus always supplies the energy. Source playback does **not** propel anything in reality. The animation is not hardware telemetry and no actuator or controller can be connected by this software.

## Default illustrative assumptions

- Simulated electrical bus: 1–50 kW (default 25 kW)
- Simulated dry vehicle mass: 5,000 kg
- Propellant reservoir: 100 kg
- Electric exhaust velocity: 20 km/s
- Jet efficiency: 62% (assumed)
- Control overhead: 2% of available bus power
- Acoustic-actuator allocation: up to 6% of bus power, modulated by bass signal
- Piezo recovery fraction: 12% of actuator input (assumed)
- Thermal trip: 85°C in a **deliberately simplified**, non-predictive thermal model
- Low-frequency audio gate: 12–88 Hz

**Energy ledger:** `P_thruster_available = P_bus - P_control - P_acoustic + P_piezo_recovered`. With `P_piezo_recovered <= P_acoustic`, the recovered energy never exceeds what was spent. The sound's amplitude governs duty cycle and cannot add net energy. The software intentionally makes no prediction about plasma resonator efficiencies, electrode voltages, sound-pressure levels, actual hardware temperatures, or warp geometry.

## Run model tests

```bash
node tests/test-core.cjs
```

No dependencies needed beyond Node.js if you want to run the optional tests. The browser demo itself does not require Node.

## Next research rungs

1. Validate DSP frequency response with calibrated test signals and file formats.
2. Replace assumed piezo recovery with measured electromechanical efficiency vs. frequency and load.
3. Model electric-thruster energy budgets using published ion/Hall thruster performance curves.
4. Create a benchtop, low-voltage sound-to-sensor-to-LED/motor proof of concept. No pressure vessels, high-voltage plasmas, or spacecraft hardware.
5. Add deterministic telemetry replay, units, and falsifiable tests before considering a real external control interface.

## License

MIT. See [LICENSE](LICENSE).

## Source distinction

The original concept included unsupported claims that 100% sound energy could convert to electricity and that rhythmic EM fields could generate forward gravity wells. Those were narrative leaps, not demonstrated physics. This project intentionally separates proven signal-processing and propulsion formulas from speculative geometry.