# G-BIOS v0.1.0 — System & Firmware Design Specification

**Status:** Implemented in part as browser-based simulation; hardware firmware is **not** implemented.

**Project:** G-Funk Powered Propulsion (Tri-Phasic G-Drive)

**License:** MIT

**Principle:** An audio signal may command thrust and provide closed-loop timing; audio by itself cannot supply extra propulsive energy. A separate electrical source powers any thruster. All mechanical energy recovery is accounted for as energy previously injected into a mechanical system.

## 1. Design scope

1. **Now (rung 1):** Offline browser simulator with synthetic and file-supplied bass, signal processing, a hypothetical piezo recovery term, a bounded electric rocket model, telemetry, and a visibly labeled fiction mode.
2. **Next (rung 2):** Deterministic replay, calibrated sensor input, physics data validation and unit tests.
3. **Benchtop (rung 3):** Isolated low-voltage audio-to-control demonstration with LEDs or a guarded low-power motor. Any actuator must have a physically separate power supply and independent emergency stop.
4. **Longer term:** Research-only spaceflight-style electrical power/thruster models; no claims of warp propulsion.

## 2. Logical system layers

```text
     User audio file / Original synth oscillator
                         │
                         ▼
       Signal conditioning + 12–88 Hz analysis
                         │
                  AudioFrame bus
                         ▼
           Gate + throttle duty scheduler
                         │
                         ├──────────────┐
                         ▼              ▼
                Power ledger       Diagnostics
                         │              │
                         ▼              │
             Electric jet model         │
                         │              │
                         ▼              ▼
                 Vehicle model    Safety supervisor
                         │              │
                         └──────┬───────┘
                                ▼
                        Telemetry / UI

    [Fictional metric visualizer: visualization only]
```

The proposed hardware firmware architecture is separate from the browser prototype. Hardware must never be actuated by merely loading this app or supplying music.

## 3. Data contracts (proposed)

| Interface | Fields | Units | Constraints |
|---|---|---|---|
| AudioFrame | `timestamp_ms`, `bass_rms`, `dominant_hz`, `valid` | ms, normalized 0–1, Hz, bool | Values are finite and timestamp monotonic |
| ThrottleCommand | `armed`, `duty`, `e_stop` | bool, normalized 0–1, bool | `e_stop` overrides all other commands |
| BusTelemetry | `bus_capacity_w`, `bus_draw_w`, `acoustic_w`, `recovered_w`, `thruster_w` | W | No negative power, `recovered_w <= acoustic_w` |
| VehicleTelemetry | `mass_kg`, `propellant_kg`, `v_m_s`, `a_m_s2`, `thrust_n` | SI | Nonnegative mass/fuel; mass-flow accounted for |
| SafetyTelemetry | `state`, `fault_code`, `temperature_c`, `sample_age_ms` | enumeration, enum, °C, ms | Faults latch until a deliberate reset |
| FictionVisualizer | `lore_warp_index` | arbitrary 0–4.20 | **Never** passed to real propulsion or physics claims |

## 4. Model equations and assumptions

Constants in `core.js` are educational placeholders, not measured equipment characteristics.

- Bus capacity `P_bus`: 1–50 kW
- Controls: `P_control = 0.02 × P_bus` when active
- Acoustic actuator input: `P_acoustic = 0.06 × P_bus × bass_level` when enabled
- Piezo recovered power: `P_recovered = 0.12 × P_acoustic`; no recovery if acoustic actuation is off
- Available thruster electrical power: `P_available = max(0, P_bus - P_control - P_acoustic + P_recovered)`
- Throttle: `u = clamp(bass_level × sensitivity, 0, 1)` when band, fuel and safety gates pass; otherwise `0`
- Electrical input to thruster: `P_thruster = u × P_available`
- Net bus draw: `P_draw = P_control + P_acoustic - P_recovered + P_thruster`
- Idealized jet kinetic power: `P_jet = η × P_thruster`, with assumed `η = 0.62`
- Idealized mass flow: `ṁ = 2P_jet / v_e²` with assumed exhaust velocity `v_e = 20,000 m/s`
- Idealized thrust: `F = ṁ × v_e = 2P_jet / v_e`
- Velocity integration (no drag or orbital dynamics): `dv/dt = F / m`, with `m` initially 5100 kg and declining as fuel is consumed

Every model cycle satisfies `0 <= P_recovered <= P_acoustic` and `0 <= P_draw <= P_bus`. The model does not validate an actual thruster, piezo matrix, plasma pressure or realistic heat transfer.

## 5. Software state machine

Intended firmware state model:

| State | Entry conditions | Allowed actions |
|---|---|---|
| BOOT | Power-up | Load signed/configured limits, set physical outputs off |
| SELF_TEST | POST | Sensor checks, command watchdog, e-stop line test |
| DISARMED | Successful POST | Telemetry, configuration; no output |
| ARMED | Operator command + all interlocks | Await valid time-stamped control data |
| ACTIVE | Valid band-limited command, independent power, safe sensors | Apply bounded, rate-limited command |
| FAULT_LATCHED | E-stop, stale sensor, overshoot, invalid configuration, thermal trip | Output physically disabled, event logged |

**Safety invariant:** A real device's hardwired power interlock, emergency stop and watchdog must outrank audio DSP, visualization, network, and general application scheduling. The prior model's claim that audio outranks life support is explicitly rejected.

The current web prototype implements a simpler **inactive / active / latched thermal trip** scheme only, for demonstration.

## 6. Timing and DSP

The prototype uses Web Audio, an 8192-point analyzer FFT (frequency-bin spacing depends on actual sample rate), a lowpass stage, sub-bass RMS signal levels, and animation-frame updates. The precise low-frequency estimate for arbitrary music is approximate; browser audio scheduling and `requestAnimationFrame` do not provide hard real-time guarantees.

A potential firmware system would require a measured worst-case interrupt/service budget, stable timebase, safe signal-age timeout, anti-alias filtering and a hardware-independent shutdown system. A 192 kHz audio sample rate is **not** a 192 kHz operating-system kernel clock.

## 7. Software module boundaries

| File | Ownership |
|---|---|
| `core.js` | Pure simulation equations and state integration; no DOM/audio dependency |
| `app.js` | Browser audio, operator controls, telemetry and visualization |
| `index.html` | UI structure |
| `styles.css` | Presentation |
| `tests/test-core.cjs` | Deterministic energy and safety model checks |

No remote API calls, cloud uploads, analytics, package manager or hidden telemetry. Audio file data is processed locally with the Web Audio API.

## 8. Test and acceptance plan

- Unit test: zero audio, out-of-band audio, disabled drive, empty tank, and thermal trip all cause zero thrust.
- Conservation test: piezo recovered power never exceeds mechanical input.
- Conservation test: bus draw never exceeds configured available electrical power.
- Equation tests: kinetic exhaust power, propellant flow and thrust remain dimensionally consistent.
- Integration test: valid command and nonzero propellant result in increasing simulated velocity.
- Browser smoke test: the synth engages on click, live readouts change, fiction mode remains clearly labeled, and emergency stop returns output to zero.
- Future test: validate frequency detection against independent tone sweep analysis and calibrated speaker-independent electrical input.
- Future test: compare an empirical low-voltage actuator sensor's measured response with predicted behavior; record error bars.

## 9. Exclusions and blocked claims

- No 100% transduction efficiency claim.
- No negative energy, space-time metric manipulation, gravitational waves or faster-than-light travel claim.
- No assumption that thin interstellar plasma is a viable propellant scoop across arbitrary routes.
- No experimental high-voltage plasma chamber, pressure vessel, thermal control or onboard spacecraft hardware in v0.1.0.
- No automatic physical control from untrusted audio files.

## 10. Suggested interoperability

If this project is later integrated with an existing **PhiGrooveDrive** or **PhiOS** codebase, use a versioned, read-only telemetry adapter first, e.g. `GDriveTelemetry/v1`. Preserve the distinction between observed sensor readings, model estimates and fictional annotations. A real physical-output driver must be a separate opt-in, reviewed module with interlocks and hard stops.