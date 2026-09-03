'use strict';

import {
  PALETTES,
  gradient,
  samplePalette,
  withGlow,
  smoothPath,
  resample,
} from './draw-utils.js';

/** White-to-ember ramp used by the ribbon preset only. */
const RIBBON = [[0, '#ffffff'], [0.35, '#ffd21e'], [0.7, '#ff5a18'], [1, '#ff2bd1']];

/**
 * Single smooth oscilloscope line with a horizontal neon gradient.
 * Reference sheet, row 1 column 1.
 */
const waveLine = {
  id: 'wave-line',
  name: 'Neon Wave',
  draw(ctx, f) {
    const mid = f.height / 2;
    const amplitude = f.height * 0.38;
    const points = [];

    for (let i = 0; i < f.waveform.length; i += 1) {
      points.push({
        x: (i / (f.waveform.length - 1)) * f.width,
        y: mid - f.waveform[i] * amplitude,
      });
    }

    ctx.strokeStyle = gradient(ctx, PALETTES.sunrise, [0, 0, f.width, 0]);
    ctx.lineWidth = Math.max(2.5, f.height * 0.008);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    withGlow(ctx, '#ffb400', 18, () => {
      ctx.beginPath();
      smoothPath(ctx, points);
      ctx.stroke();
    });
  },
};

/**
 * Stack of phase-shifted lines that flow like a ribbon of water.
 * Reference sheet, row 2 column 1.
 */
const multiLine = {
  id: 'multi-line',
  name: 'Flow Lines',
  lineCount: 9,
  draw(ctx, f) {
    const mid = f.height / 2;
    const spread = f.height * 0.5;
    const gap = spread / (this.lineCount - 1);
    const samples = f.waveform.length;

    ctx.lineWidth = Math.max(1.4, f.height * 0.004);
    ctx.lineCap = 'round';

    for (let line = 0; line < this.lineCount; line += 1) {
      const t = line / (this.lineCount - 1);
      // Lines share one waveform but read it at a shifted offset, which reads
      // as the same wave travelling through the stack.
      const offset = Math.round(line * samples * 0.06);
      // Derived from the real baseline spacing rather than a hand-tuned
      // fraction of the height: peak deviation has to stay under half the gap,
      // or neighbouring lines cross and the stack collapses into one tangled
      // band instead of the reference's separated ribbons.
      const amplitude = gap * (0.28 + 0.16 * Math.sin(t * Math.PI));
      const baseY = mid - spread / 2 + t * spread;
      const points = [];

      for (let i = 0; i < samples; i += 1) {
        const value = f.waveform[(i + offset) % samples];
        points.push({
          x: (i / (samples - 1)) * f.width,
          y: baseY + value * amplitude,
        });
      }

      ctx.strokeStyle = samplePalette(PALETTES.candy, t);
      ctx.globalAlpha = 0.55 + 0.45 * (1 - Math.abs(t - 0.5) * 2);
      ctx.beginPath();
      smoothPath(ctx, points);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  },
};

/**
 * Slow layered sine ribbon whose amplitude and phase speed track loudness.
 * Reference sheet, row 4 column 2.
 */
const sineRibbon = {
  id: 'sine-ribbon',
  name: 'Sine Ribbon',
  layers: 10,
  draw(ctx, f) {
    const mid = f.height / 2;
    const steps = 120;
    // Driven by the slow level, not the raw one: tying amplitude and phase
    // speed to per-frame loudness made the ribbon stutter on every transient.
    const amplitude = f.height * (0.12 + f.levelSmooth * 0.3);
    const phase = f.time * (0.35 + f.levelSmooth * 0.5);

    ctx.lineWidth = Math.max(1.6, f.height * 0.005);
    ctx.lineCap = 'round';

    for (let layer = 0; layer < this.layers; layer += 1) {
      const t = layer / (this.layers - 1);
      const points = [];

      for (let i = 0; i <= steps; i += 1) {
        const x = (i / steps) * f.width;
        const angle = (i / steps) * Math.PI * 2 + phase - t * 0.35;
        points.push({
          x,
          y: mid + Math.sin(angle) * amplitude * (1 - t * 0.25) + t * f.height * 0.055,
        });
      }

      ctx.strokeStyle = samplePalette(RIBBON, t);
      ctx.globalAlpha = 1 - t * 0.45;
      ctx.beginPath();
      smoothPath(ctx, points);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  },
};

/**
 * Dense alternating spikes around a baseline, driven by per-band energy.
 * Reference sheet, row 5 column 2.
 */
const spikyWave = {
  id: 'spiky-wave',
  name: 'Spike Wave',
  draw(ctx, f) {
    const mid = f.height / 2;
    const spikes = 70;
    // resample keeps the loudest bin per spike; indexing f.bands directly
    // stepped over roughly a third of the bands and dropped narrow tones.
    const energies = resample(f.bands, spikes);
    const maxUp = f.height * 0.36;
    const maxDown = f.height * 0.22;
    const step = f.width / spikes;

    ctx.strokeStyle = gradient(ctx, PALETTES.violet, [0, 0, f.width, 0]);
    ctx.lineWidth = Math.max(1.6, f.height * 0.005);
    ctx.lineJoin = 'miter';

    withGlow(ctx, '#c93bff', 12, () => {
      ctx.beginPath();
      ctx.moveTo(0, mid);

      for (let i = 0; i < spikes; i += 1) {
        const value = f.waveform[Math.floor((i / spikes) * f.waveform.length)];
        const energy = energies[i];
        const x = i * step;

        // Up spike then a shorter down spike, giving the asymmetric comb look.
        // Clamped because |value| and energy both reach 1, and the unclamped
        // product hit 1.5x maxUp, which ran off the top of the cell.
        const up = Math.min(maxUp, Math.abs(value) * maxUp * (0.5 + energy));
        ctx.lineTo(x + step * 0.3, mid - up);
        ctx.lineTo(x + step * 0.5, mid);
        ctx.lineTo(x + step * 0.7, mid + energy * maxDown);
        ctx.lineTo(x + step, mid);
      }

      ctx.stroke();
    });
  },
};

export const wavePresets = [waveLine, multiLine, sineRibbon, spikyWave];
