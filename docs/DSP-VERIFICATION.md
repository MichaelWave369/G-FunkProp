# G-BIOS Rung 4 · Live Bass Signal Verification

## What changed

The live source path (generated tone **and** local audio-file playback) now uses `GBIOSDSP.analyze()` to estimate the dominant low-frequency component and its confidence from a PCM sample window. The previous algorithm measured a broad lowpass RMS and picked only an in-band FFT peak, potentially mistaking strong out-of-band bass for an allowed control signal.

The detector operates on the Web Audio analyzer's **32,768-sample** window (approximately **0.683 seconds at 48 kHz**) at approximately **10 analyses per second** to manage CPU load.

1. Audio is low-pass filtered near 88 Hz in the existing Web Audio graph.
2. PCM samples are box-averaged into a lower-rate window (upstream filtering remains important; box averaging alone is not a certified anti-alias filter).
3. DC offset is removed and Hann windowing is applied.
4. Goertzel spectral estimates cover **6–120 Hz** in 1 Hz increments, including frequencies *outside* the operating gate.
5. A strongest-peak estimate uses neighboring spectral magnitudes for sub-bin interpolation.
6. If the dominant component is **12–88 Hz inclusive**, has a tonal confidence of **at least 0.22**, and exceeds the minimum RMS gate, the detected window can drive the **existing idealized electric-thruster math**.
7. Otherwise simulated thrust remains zero; the cockpit displays a rejection / no-lock reason.

The generated oscillator is now verified through the same PCM estimator used for user audio files; it no longer bypasses detection by merely trusting the slider frequency. This remains an educational real-time signal estimator, not a laboratory-calibrated instrument or a sensor for physical propulsion.

## Repeatable synthetic checks

```bash
node tests/test-dsp.cjs
node tests/test-core.cjs
node tests/test-bench.cjs
```

The deterministic suite checks:

- Silence, subthreshold levels and insufficient PCM windows
- In-band sinusoidal tones at **12, 18, 42, 63, 88 Hz**
- Out-of-band tones at **6, 9, 10, 90, 95, 110 Hz**
- Strong in-band + weak out-of-band mixtures, and the reverse
- Seeded broadband synthetic noise
- Exact reproducibility and reported accuracy within **1.2 Hz** for the chosen clean synthetic test tones

**This suite validates the pure JavaScript estimator on known synthesized data.** It does not establish equivalent microphone, browser, audio driver, analog electronics or speaker accuracy. Browser implementations and listening environments vary.

## Accuracy and limitations

- A 0.68 second window smooths changes over time. Short notes and transients can show delayed or inconclusive locking; even after an update it takes time for the window to fill.
- The strongest tonal component may not be the musical *fundamental* or the most perceptually important bass note; the display intentionally says **DOMINANT**.
- Lowpass filter attenuation above 88 Hz and the downstream box average are not laboratory-characterized anti-alias filtering.
- Signals consisting mostly of noise or complex bass can fail the intentionally conservative single-tone confidence test. An undecided gate defaults to zero thrust.
- The estimator is an experimental audio-controlled interface for a *simulation*, not a thrust sensor, calibrated measurement system, or control firmware for motors, plasma injectors, high voltage or medical devices.
- The fictional metric warp mode stays separate from verified electric-thruster equations.
- No source audio, FFT/Goertzel data, or exported output leaves the browser; no external connection is needed.

## Future improvements

A useful next experiment is to test the **full Web Audio graph in actual browsers**, across sample rates, browser implementations and tones just inside/outside the gate (e.g. 11.5, 12, 88, 88.5 Hz), with documented tolerance and uncertainty. Follow with measured piezoelectric transfer efficiencies using safe low-voltage apparatus.
