'use strict';

import {
  PALETTES,
  gradient,
  withGlow,
  roundedRect,
  smoothPath,
  resample,
} from './draw-utils.js';

/**
 * Filled envelope that bulges around the centre line — the amplitude "blob"
 * shape. Reference sheet, row 2 column 3.
 */
const envelopeBlob = {
  id: 'envelope-blob',
  name: 'Envelope',
  points: 90,
  draw(ctx, f) {
    const mid = f.height / 2;
    const maxHalf = f.height * 0.44;
    const step = f.width / (this.points - 1);

    const top = [];
    const bottom = [];
    for (let i = 0; i < this.points; i += 1) {
      const value = f.bands[Math.floor((i / this.points) * f.bands.length)];
      // Taper the ends so the shape reads as a lens rather than a cut-off bar.
      const taper = Math.sin((i / (this.points - 1)) * Math.PI) ** 0.4;
      const half = Math.max(f.height * 0.008, value * maxHalf * taper);
      const x = i * step;
      top.push({ x, y: mid - half });
      bottom.push({ x, y: mid + half });
    }

    ctx.fillStyle = gradient(ctx, PALETTES.ember, [0, mid - maxHalf, 0, mid + maxHalf]);

    ctx.beginPath();
    smoothPath(ctx, top);
    smoothPath(ctx, bottom.reverse(), false);
    ctx.closePath();

    withGlow(ctx, '#ff5a18', 16, () => ctx.fill());
  },
};

/**
 * Mirrored bars in two colours: cyan above the axis, magenta below.
 * Reference sheet, row 4 column 3.
 */
const dualMirror = {
  id: 'dual-mirror',
  name: 'Dual Mirror',
  columns: 100,
  draw(ctx, f) {
    const values = resample(f.bands, this.columns);
    const mid = f.height / 2;
    const slot = f.width / this.columns;
    const barWidth = Math.max(1.5, slot * 0.5);
    const maxHalf = f.height * 0.42;

    for (let c = 0; c < this.columns; c += 1) {
      const x = c * slot + (slot - barWidth) / 2;
      const upper = Math.max(barWidth / 2, values[c] * maxHalf);
      // The lower half trails the upper one, so the two colours never mirror
      // perfectly and the shape stays lively.
      const lower = Math.max(barWidth / 2, upper * (0.55 + f.bass * 0.5));

      ctx.fillStyle = '#22e5ff';
      roundedRect(ctx, x, mid - upper, barWidth, upper, barWidth / 2);
      ctx.fill();

      ctx.fillStyle = '#ff2bd1';
      roundedRect(ctx, x, mid, barWidth, lower, barWidth / 2);
      ctx.fill();
    }
  },
};

/**
 * Soft filled hills: a smooth low-resolution spectrum with rounded peaks.
 * Reference sheet, row 5 column 1.
 */
const smoothHills = {
  id: 'smooth-hills',
  name: 'Smooth Hills',
  columns: 26,
  draw(ctx, f) {
    const values = resample(f.bands, this.columns);
    const baseY = f.height * 0.94;
    const maxHeight = f.height * 0.82;
    const step = f.width / (this.columns - 1);

    const points = [{ x: -step, y: baseY }];
    for (let c = 0; c < this.columns; c += 1) {
      points.push({ x: c * step, y: baseY - values[c] * maxHeight });
    }
    points.push({ x: f.width + step, y: baseY });

    ctx.fillStyle = gradient(ctx, PALETTES.sunrise, [0, 0, f.width, 0]);

    ctx.beginPath();
    smoothPath(ctx, points);
    ctx.lineTo(f.width + step, baseY);
    ctx.lineTo(-step, baseY);
    ctx.closePath();

    withGlow(ctx, '#ffb400', 20, () => ctx.fill());
  },
};

/**
 * Deterministic pseudo-random in [0,1) for a slot. Fixed per slot on purpose:
 * re-rolling each frame would make the whole mark shimmer, whereas a constant
 * value just makes neighbours unequal the way the hand-drawn emblem is.
 */
function slotNoise(index, seed) {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Row of four-pointed stars mirrored about the axis, one per frequency band,
 * so each one springs up and down in place rather than drifting sideways.
 *
 * Ink on paper rather than neon: the shape is a flat silhouette, and glow or a
 * gradient would blunt the points that give it its character.
 */
const spindleWave = {
  id: 'spindle-wave',
  name: 'Tacet Mark',
  background: '#f2f0ec',
  slots: 34,
  draw(ctx, f) {
    const mid = f.height / 2;
    const slots = this.slots;
    const levels = resample(f.bands, slots);
    const slotWidth = f.width / slots;
    const maxHalf = f.height * 0.46;

    // The emblem always has one spike towering over the rest; picking the
    // loudest band keeps that focal point moving with the music.
    let peakSlot = 0;
    for (let c = 1; c < slots; c += 1) {
      if (levels[c] > levels[peakSlot]) peakSlot = c;
    }

    // Loudest band within a few slots either side. Placement is judged against
    // this rather than the global peak: measured globally, a strong bass note
    // gated out the whole treble half and the mark lost its right-hand tail.
    const NEIGHBOURHOOD = 4;
    const localMax = new Array(slots);
    for (let c = 0; c < slots; c += 1) {
      let loudest = 0;
      const from = Math.max(0, c - NEIGHBOURHOOD);
      const to = Math.min(slots - 1, c + NEIGHBOURHOOD);
      for (let k = from; k <= to; k += 1) {
        if (levels[k] > loudest) loudest = levels[k];
      }
      localMax[c] = loudest;
    }

    const centreWeight = (c) => {
      const t = slots === 1 ? 0.5 : c / (slots - 1);
      return Math.sin(Math.PI * t);
    };

    ctx.fillStyle = '#111014';

    // --- Horizontal spine -------------------------------------------------
    // A continuous ribbon, thick at the centre and tapering to hairline points.
    // Without it the stars read as loose diamonds rather than one sound-wave
    // mark, which is what ties the reference together.
    const upper = [];
    const lower = [];
    for (let c = 0; c < slots; c += 1) {
      const thickness =
        f.height * 0.018 * centreWeight(c) ** 1.7 * (0.18 + 0.82 * levels[c]);
      const x = c * slotWidth + slotWidth / 2;
      upper.push({ x, y: mid - thickness });
      lower.push({ x, y: mid + thickness });
    }

    ctx.beginPath();
    ctx.moveTo(0, mid);
    smoothPath(ctx, upper, false);
    ctx.lineTo(f.width, mid);
    smoothPath(ctx, lower.reverse(), false);
    ctx.closePath();
    ctx.fill();

    // --- Stars ------------------------------------------------------------
    ctx.beginPath();
    for (let c = 0; c < slots; c += 1) {
      // Placement: a slot must stand out within its own neighbourhood, with a
      // fixed per-slot bar so the survivors are scattered rather than evenly
      // spaced. This is what leaves real gaps of bare spine.
      if (levels[c] < localMax[c] * (0.5 + 0.42 * slotNoise(c, 1))) continue;

      // Size: measured against the loudest band overall, so the whole mark
      // still swells and shrinks with the music instead of self-levelling.
      const strength = levels[c] / Math.max(0.001, levels[peakSlot]);
      const bell = 0.24 + 0.76 * centreWeight(c) ** 1.1;
      let half = strength ** 1.25 * bell * (0.55 + 0.45 * slotNoise(c, 2)) * maxHalf;
      if (c === peakSlot) half *= 1.32;
      if (half < f.height * 0.018) continue;

      // Slight lean, because perfectly mirrored spikes look mechanical.
      const lean = (slotNoise(c, 3) - 0.5) * 0.34;
      // Clamped so the tallest spike cannot run off the top of the cell, which
      // it did once the peak boost and the lean stacked up.
      const limit = f.height * 0.47;
      const up = Math.min(limit, half * (1 + lean));
      const down = Math.min(limit, half * (1 - lean));

      // Width follows height, capped by the slot. At a fixed width the short
      // stars stayed as wide as the tall ones and the row fused into a band.
      const halfWidth = Math.min(slotWidth * 0.5, half * 0.3);
      // Control points sit near the axis, pulling the sides concave so each
      // shape tapers to a point instead of bulging like an ellipse.
      const pull = halfWidth * 0.18;
      const cx = c * slotWidth + slotWidth / 2;

      ctx.moveTo(cx, mid - up);
      ctx.quadraticCurveTo(cx + pull, mid - up * 0.34, cx + halfWidth, mid);
      ctx.quadraticCurveTo(cx + pull, mid + down * 0.34, cx, mid + down);
      ctx.quadraticCurveTo(cx - pull, mid + down * 0.34, cx - halfWidth, mid);
      ctx.quadraticCurveTo(cx - pull, mid - up * 0.34, cx, mid - up);
    }
    ctx.fill();
  },
};

export const mirrorPresets = [envelopeBlob, dualMirror, smoothHills, spindleWave];
