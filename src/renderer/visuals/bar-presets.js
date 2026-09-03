'use strict';

import {
  PALETTES,
  gradient,
  samplePalette,
  withGlow,
  roundedRect,
  resample,
} from './draw-utils.js';

/**
 * Classic segmented equalizer: each column is a stack of discrete blocks that
 * light up from the bottom. Reference sheet, row 1 column 2.
 */
const blockBars = {
  id: 'block-bars',
  name: 'Block EQ',
  columns: 34,
  segments: 14,
  draw(ctx, f) {
    const values = resample(f.bands, this.columns);
    const peaks = resample(f.peaks, this.columns);
    const slot = f.width / this.columns;
    const barWidth = slot * 0.68;
    const segmentHeight = (f.height * 0.9) / this.segments;
    const blockHeight = segmentHeight * 0.62;
    const baseY = f.height * 0.95;

    for (let c = 0; c < this.columns; c += 1) {
      const x = c * slot + (slot - barWidth) / 2;
      const lit = Math.round(values[c] * this.segments);
      const peakSegment = Math.round(peaks[c] * this.segments) - 1;

      for (let s = 0; s < this.segments; s += 1) {
        const y = baseY - (s + 1) * segmentHeight;
        const isLit = s < lit;
        const isPeak = s === peakSegment && peakSegment >= lit;
        if (!isLit && !isPeak) continue;

        ctx.fillStyle = samplePalette(PALETTES.candy, 1 - s / this.segments);
        ctx.globalAlpha = isPeak && !isLit ? 0.5 : 1;
        roundedRect(ctx, x, y, barWidth, blockHeight, blockHeight * 0.25);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
  },
};

/**
 * Narrow mirrored bars radiating from the centre line.
 * Reference sheet, row 2 column 2.
 */
const thinBars = {
  id: 'thin-bars',
  name: 'Thin Bars',
  columns: 96,
  draw(ctx, f) {
    const values = resample(f.bands, this.columns);
    const mid = f.height / 2;
    const slot = f.width / this.columns;
    const barWidth = Math.max(1.5, slot * 0.42);
    const maxHalf = f.height * 0.44;

    ctx.fillStyle = gradient(ctx, PALETTES.ocean, [0, 0, f.width, 0]);

    withGlow(ctx, '#22c9ff', 10, () => {
      for (let c = 0; c < this.columns; c += 1) {
        const half = Math.max(barWidth / 2, values[c] * maxHalf);
        const x = c * slot + (slot - barWidth) / 2;
        roundedRect(ctx, x, mid - half, barWidth, half * 2, barWidth / 2);
        ctx.fill();
      }
    });
  },
};

/**
 * Mixer-style vertical sliders: a full-height track per band with a knob that
 * rides the current level. Reference sheet, row 3 column 1.
 */
const sliderEq = {
  id: 'slider-eq',
  name: 'Slider Mixer',
  columns: 16,
  draw(ctx, f) {
    const values = resample(f.bands, this.columns);
    const slot = f.width / this.columns;
    const trackWidth = Math.min(slot * 0.36, f.width * 0.02);
    const top = f.height * 0.12;
    const bottom = f.height * 0.88;
    const travel = bottom - top;
    const knobRadius = Math.max(4, trackWidth * 0.95);
    // Every track shares one vertical ramp, so build it once per frame rather
    // than rebuilding an identical gradient object per column.
    const trackFill = gradient(ctx, PALETTES.spectrum, [0, top, 0, bottom]);

    for (let c = 0; c < this.columns; c += 1) {
      const x = c * slot + slot / 2 - trackWidth / 2;
      const knobY = bottom - values[c] * travel;

      ctx.fillStyle = trackFill;
      roundedRect(ctx, x, top, trackWidth, travel, trackWidth / 2);
      ctx.fill();

      // Knob is a hollow ring so the track colour reads through it.
      ctx.strokeStyle = '#e8f4ff';
      ctx.lineWidth = Math.max(1.5, trackWidth * 0.22);
      withGlow(ctx, '#ffffff', 8, () => {
        ctx.beginPath();
        ctx.arc(x + trackWidth / 2, knobY, knobRadius, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
  },
};

/**
 * Outline-only columns that interlock above and below the centre line.
 * Reference sheet, row 3 column 2.
 */
const outlineBars = {
  id: 'outline-bars',
  name: 'Outline Bars',
  columns: 44,
  draw(ctx, f) {
    const values = resample(f.bands, this.columns);
    const mid = f.height / 2;
    const slot = f.width / this.columns;
    const barWidth = slot * 0.82;
    const maxHalf = f.height * 0.4;

    ctx.strokeStyle = gradient(ctx, PALETTES.duo, [0, 0, f.width, 0]);
    ctx.lineWidth = Math.max(1.2, f.height * 0.004);

    for (let c = 0; c < this.columns; c += 1) {
      // Alternating anchor points give the interlocking look of the reference
      // instead of a plain symmetric mirror.
      const half = Math.max(f.height * 0.02, values[c] * maxHalf);
      const height = half * 1.35;
      const y = c % 2 === 0 ? mid - half : mid - half * 0.35;
      const x = c * slot + (slot - barWidth) / 2;

      ctx.strokeRect(x, y, barWidth, height);
    }
  },
};

/**
 * Solid gradient silhouette with hard vertical steps.
 * Reference sheet, row 3 column 3.
 */
const gradientPeaks = {
  id: 'gradient-peaks',
  name: 'Gradient Peaks',
  columns: 60,
  draw(ctx, f) {
    const values = resample(f.bands, this.columns);
    const slot = f.width / this.columns;
    const baseY = f.height * 0.95;
    const maxHeight = f.height * 0.82;

    ctx.fillStyle = gradient(ctx, PALETTES.sunrise, [0, 0, f.width, 0]);

    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let c = 0; c < this.columns; c += 1) {
      const y = baseY - Math.max(f.height * 0.015, values[c] * maxHeight);
      ctx.lineTo(c * slot, y);
      ctx.lineTo((c + 1) * slot, y);
    }
    ctx.lineTo(f.width, baseY);
    ctx.closePath();

    withGlow(ctx, '#ffd21e', 14, () => ctx.fill());
  },
};

/**
 * Two offset layers of hairline bars producing a woven green/orange texture.
 * Reference sheet, row 5 column 3.
 */
const layeredSpectrum = {
  id: 'layered-spectrum',
  name: 'Layered Spectrum',
  columns: 120,
  draw(ctx, f) {
    const values = resample(f.bands, this.columns);
    const peaks = resample(f.peaks, this.columns);
    const mid = f.height / 2;
    const slot = f.width / this.columns;
    const barWidth = Math.max(1, slot * 0.55);
    const maxHalf = f.height * 0.42;

    // Back layer: the slower peak envelope in warm orange.
    ctx.fillStyle = '#ff7a18';
    ctx.globalAlpha = 0.75;
    for (let c = 0; c < this.columns; c += 1) {
      const half = peaks[c] * maxHalf;
      ctx.fillRect(c * slot, mid - half, barWidth, half * 2);
    }

    // Front layer: live bands in green, narrower so both layers stay readable.
    ctx.fillStyle = '#8fff2b';
    ctx.globalAlpha = 0.9;
    for (let c = 0; c < this.columns; c += 1) {
      const half = values[c] * maxHalf;
      ctx.fillRect(c * slot + barWidth * 0.25, mid - half, barWidth * 0.55, half * 2);
    }

    ctx.globalAlpha = 1;
  },
};

export const barPresets = [
  blockBars,
  thinBars,
  sliderEq,
  outlineBars,
  gradientPeaks,
  layeredSpectrum,
];
