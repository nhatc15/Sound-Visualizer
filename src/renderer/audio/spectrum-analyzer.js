'use strict';

const MIN_HZ = 26;
const MAX_HZ = 16000;

/**
 * Fraction of the time-domain buffer actually drawn. Kept small on purpose:
 * a short window shows a few large cycles instead of a dense ripple, and the
 * remainder becomes search room for the trigger.
 */
const WAVE_WINDOW_RATIO = 0.3;
/**
 * The signal must first dip this far below zero before a rising crossing counts
 * as a trigger. Without it the search latches onto noise wiggles around zero
 * and the picked phase jumps frame to frame.
 */
const TRIGGER_HYSTERESIS = 6 / 128;

/** Time constant for waveform smoothing; larger = calmer but less responsive. */
const WAVE_SMOOTHING_SECONDS = 0.08;

/**
 * Turns raw FFT bins into the shapes visual presets actually want:
 * log-spaced bands (so bass does not eat the whole left edge), attack/release
 * smoothed levels, falling peak markers, a normalised waveform and coarse
 * bass/mid/treble energies.
 *
 * All outputs are reused arrays — presets must read, never retain them.
 */
export class SpectrumAnalyzer {
  /**
   * @param {object} options
   * @param {number} options.bandCount Number of log-spaced output bands.
   * @param {number} options.waveformPoints Downsampled time-domain points.
   */
  constructor({ bandCount = 96, waveformPoints = 256 } = {}) {
    this.bandCount = bandCount;

    this.bands = new Float32Array(bandCount); // 0..1, smoothed
    this.peaks = new Float32Array(bandCount); // 0..1, slow decay
    this.waveform = new Float32Array(waveformPoints); // -1..1
    this.level = 0; // overall loudness 0..1
    /** Slow-moving loudness for driving animation, so motion does not twitch. */
    this.levelSmooth = 0;
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    /** Kick pulse: snaps to 1 on a low-end onset, then falls back to 0. */
    this.beat = 0;
    /** User gain on top of the automatic levelling, 1 = as captured. */
    this.sensitivity = 1;

    this._rawWave = new Float32Array(waveformPoints);
    this._smoothWave = new Float32Array(waveformPoints);
    this._peakVelocity = new Float32Array(bandCount);
    this._binRanges = null; // [startBin, endBin] per band
    this._autoGain = 1;
    this._bassFloor = 0;
    this._beatHold = 0;
    this._prevBass = 0;
  }

  /**
   * Precomputes which FFT bins feed each band. Cheap, but depends on the
   * device sample rate, so it runs once the AudioContext exists.
   */
  buildBandMap(binWidthHz, binCount) {
    const ranges = new Array(this.bandCount);
    const lastBin = binCount - 1;
    // An endpoint below 32 kHz — a Bluetooth headset in hands-free mode reports
    // 16 kHz — has no bins at all above its own Nyquist. Spreading bands up to
    // MAX_HZ regardless walked every high band past the end of the buffer,
    // where reads return undefined and the top half of every preset sits
    // permanently flat. Fold the range onto what the device actually has.
    const topHz = Math.min(MAX_HZ, lastBin * binWidthHz);
    const logMin = Math.log2(MIN_HZ);
    const logMax = Math.log2(Math.max(MIN_HZ * 2, topHz));

    let previousEnd = Math.min(lastBin, Math.max(1, Math.floor(MIN_HZ / binWidthHz)));

    for (let i = 0; i < this.bandCount; i += 1) {
      const upperHz = 2 ** (logMin + ((i + 1) / this.bandCount) * (logMax - logMin));
      let end = Math.min(lastBin, Math.round(upperHz / binWidthHz));
      // Guarantee every band owns at least one bin, otherwise the low end
      // renders as dead gaps at high band counts.
      if (end < previousEnd) end = previousEnd;
      ranges[i] = [previousEnd, end];
      previousEnd = Math.min(lastBin, end + 1);
    }

    this._binRanges = ranges;
  }

  /**
   * @param {Uint8Array} frequencyData Bytes from getByteFrequencyData.
   * @param {Uint8Array} timeDomainData Bytes from getByteTimeDomainData.
   * @param {number} deltaSeconds Frame time, keeps decay framerate-independent.
   */
  update(frequencyData, timeDomainData, deltaSeconds) {
    if (!this._binRanges) return;

    const dt = Math.min(deltaSeconds, 0.1);
    // Attack fast so transients pop, release slower so bars glide down.
    const attack = 1 - Math.exp(-dt / 0.035);
    const release = 1 - Math.exp(-dt / 0.16);

    let sum = 0;
    let bassSum = 0;
    let midSum = 0;
    let trebleSum = 0;
    let bassCount = 0;
    let midCount = 0;
    let trebleCount = 0;

    for (let i = 0; i < this.bandCount; i += 1) {
      const [start, end] = this._binRanges[i];

      // Peak-within-band beats averaging: narrow tones stay visible instead of
      // being diluted by the silent bins beside them.
      let peakByte = 0;
      for (let bin = start; bin <= end; bin += 1) {
        const value = frequencyData[bin];
        if (value > peakByte) peakByte = value;
      }

      let target = peakByte / 255;
      // Gentle high-frequency tilt: music has far less energy up top, so
      // without it the right half of every preset stays flat.
      target *= 1 + (i / this.bandCount) * 0.55;
      target *= this.sensitivity;
      target = Math.min(1, target);

      const current = this.bands[i];
      this.bands[i] = current + (target - current) * (target > current ? attack : release);

      sum += this.bands[i];
      const position = i / this.bandCount;
      if (position < 0.18) {
        bassSum += this.bands[i];
        bassCount += 1;
      } else if (position < 0.6) {
        midSum += this.bands[i];
        midCount += 1;
      } else {
        trebleSum += this.bands[i];
        trebleCount += 1;
      }

      this._updatePeak(i, dt);
    }

    this.level = sum / this.bandCount;
    this.levelSmooth += (this.level - this.levelSmooth) * (1 - Math.exp(-dt / 0.4));
    this.bass = bassCount ? bassSum / bassCount : 0;
    this.mid = midCount ? midSum / midCount : 0;
    this.treble = trebleCount ? trebleSum / trebleCount : 0;

    this._updateBeat(dt);
    this._updateWaveform(timeDomainData, dt);
  }

  /**
   * Fires `beat` on low-end onsets, which the themed presets use for kick
   * accents: screen shake, strobes, shockwaves.
   *
   * The test is bass *above its own recent floor*, not bass above a fixed
   * level. A sustained bassline drags the floor up with it and stops firing,
   * while a kick — a jump over that floor — still fires, so the pulse follows
   * the drum rather than the loudness.
   */
  _updateBeat(dt) {
    this._bassFloor += (this.bass - this._bassFloor) * (1 - Math.exp(-dt / 0.32));
    // Linear fall over ~0.16s. An exponential tail never quite reaches zero, so
    // a preset scaling a flash by `beat` would keep a faint glow lit forever.
    this.beat = Math.max(0, this.beat - dt / 0.16);
    this._beatHold = Math.max(0, this._beatHold - dt);

    // Rate of climb, not just "above the floor". The decaying tail of a kick
    // still sits well clear of the floor for a tenth of a second, so an
    // excess-alone test fires twice per hit, and a sound that merely switches
    // on climbs toward its own level for long enough to fire several times.
    // A kick's attack is an order of magnitude steeper than either.
    const rise = (this.bass - this._prevBass) / dt;
    this._prevBass = this.bass;

    // Refractory window on top, or the several frames an attack takes to climb
    // each fire in turn and the accent stutters instead of hitting once.
    if (this._beatHold > 0) return;
    if (rise > 1.2 && this.bass > 0.12 && this.bass - this._bassFloor > 0.045) {
      this.beat = 1;
      this._beatHold = 0.12;
    }
  }

  /** Peak marker rises instantly, then falls under constant acceleration. */
  _updatePeak(index, dt) {
    const band = this.bands[index];
    if (band >= this.peaks[index]) {
      this.peaks[index] = band;
      this._peakVelocity[index] = 0;
      return;
    }
    this._peakVelocity[index] += 1.6 * dt;
    this.peaks[index] = Math.max(band, this.peaks[index] - this._peakVelocity[index] * dt);
  }

  /**
   * Downsamples the time domain into the preset-facing waveform.
   *
   * Two things stop the shape from thrashing. First an oscilloscope-style
   * trigger: the drawn window starts at a rising zero crossing, so a steady
   * tone lands at the same phase every frame instead of a random slice that
   * appears to race sideways. Then per-point smoothing, so what survives the
   * trigger still eases between frames rather than snapping.
   */
  _updateWaveform(timeDomainData, dt) {
    const points = this.waveform.length;
    const total = timeDomainData.length;
    const windowLength = Math.floor(total * WAVE_WINDOW_RATIO);
    const searchLimit = total - windowLength;

    let trigger = 0;
    let armed = false;
    for (let i = 0; i < searchLimit; i += 1) {
      const value = (timeDomainData[i] - 128) / 128;
      if (value < -TRIGGER_HYSTERESIS) {
        armed = true;
      } else if (armed && value >= 0) {
        trigger = i;
        break;
      }
    }

    const step = windowLength / points;
    let maxAbs = 0;

    for (let i = 0; i < points; i += 1) {
      const start = trigger + Math.floor(i * step);
      const end = trigger + Math.floor((i + 1) * step);

      // Keep the sample furthest from silence in each slice so sharp
      // transients survive the downsample instead of averaging away.
      let extreme = 0;
      for (let s = start; s < end && s < total; s += 1) {
        const value = (timeDomainData[s] - 128) / 128;
        if (Math.abs(value) > Math.abs(extreme)) extreme = value;
      }

      this._rawWave[i] = extreme;
    }

    // Smooth first, normalise second. Frames the trigger cannot align perfectly
    // partially cancel when averaged, so gain computed before smoothing leaves
    // the wave visibly flattened; measuring the smoothed peak restores height.
    const smoothing = 1 - Math.exp(-dt / WAVE_SMOOTHING_SECONDS);
    for (let i = 0; i < points; i += 1) {
      this._smoothWave[i] += (this._rawWave[i] - this._smoothWave[i]) * smoothing;
      const magnitude = Math.abs(this._smoothWave[i]);
      if (magnitude > maxAbs) maxAbs = magnitude;
    }

    // Slow auto-gain so quiet passages still draw a readable shape.
    const targetGain = maxAbs > 0.02 ? Math.min(6, 0.85 / maxAbs) : 1;
    this._autoGain += (targetGain - this._autoGain) * 0.05;

    for (let i = 0; i < points; i += 1) {
      const scaled = this._smoothWave[i] * this._autoGain * this.sensitivity;
      this.waveform[i] = Math.max(-1, Math.min(1, scaled));
    }
  }
}
