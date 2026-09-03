'use strict';

import { resample, smoothPath } from '../draw-utils.js';
import { verticalWash, radialWash, speckField, bandRange } from './theme-utils.js';

/** Hill layers, back to front: hazy, mid, and the near silhouette. */
const HILLS = [
  { fill: '#a1552a', baseline: 0.56, amplitude: 0.085, drift: 0.012 },
  { fill: '#6b3418', baseline: 0.68, amplitude: 0.07, drift: 0.026 },
  { fill: '#2f1a0f', baseline: 0.82, amplitude: 0.055, drift: 0.05 },
];

/**
 * Country — late sun over open land. The spectrum becomes terrain: three
 * layers of rolling hills, each reading the same bands at its own scale and
 * drifting at its own speed, so the frame has depth instead of one skyline.
 *
 * Treble plucks the telegraph wires. Nothing here flashes; the fastest thing
 * on screen is the dust.
 */
export const countryRoad = {
  id: 'country-road',
  name: 'Dust Road',
  background: '#2a1a10',
  hillSlots: 22,
  poles: 5,

  draw(ctx, f) {
    const unit = Math.min(f.width, f.height);

    verticalWash(ctx, f, [
      [0, '#3b2a1d'],
      [0.32, '#8a4a24'],
      [0.62, '#c1642a'],
      [0.85, '#e8b064'],
      [1, '#f4e3c1'],
    ]);
    this._sun(ctx, f, unit);

    const levels = resample(f.bands, this.hillSlots);
    HILLS.forEach((layer, index) => this._hill(ctx, f, unit, layer, levels, index));

    this._wires(ctx, f, unit);
    speckField(ctx, f, {
      count: 55,
      color: '#f4e3c1',
      alpha: 0.35,
      radius: unit * 0.0045,
      driftX: -0.03,
      driftY: -0.004,
      seed: 41,
    });
    // Paper tooth over the whole frame; keeps the flat fills from looking like
    // vector shapes.
    speckField(ctx, f, { count: 130, color: '#3a2417', alpha: 0.1, radius: unit * 0.002, seed: 42 });
  },

  /** Low sun, its bloom breathing on the low end. */
  _sun(ctx, f, unit) {
    const cx = f.width * 0.7;
    const cy = f.height * 0.44;
    const lift = bandRange(f.bands, 0, 0.18);

    radialWash(ctx, f, cx, cy, unit * (0.4 + lift * 0.2), [
      [0, 'rgba(255,238,190,0.5)'],
      [1, 'rgba(255,238,190,0)'],
    ]);
    ctx.save();
    ctx.fillStyle = '#fff3cd';
    ctx.beginPath();
    ctx.arc(cx, cy, unit * (0.075 + lift * 0.012), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  /**
   * One hill layer. Reading the bands at an offset per layer means the three
   * ridges never share a crest, which is what sells them as separate distances
   * rather than one shape drawn three times.
   */
  _hill(ctx, f, unit, layer, levels, index) {
    const points = [];
    const shift = f.time * layer.drift;

    for (let i = 0; i <= this.hillSlots; i += 1) {
      const t = i / this.hillSlots;
      const band = levels[(i + index * 7) % this.hillSlots];
      // A slow sine under the band value keeps the ground rolling during quiet
      // passages, so the layer never flattens to a straight line.
      const roll = Math.sin(t * Math.PI * (1.5 + index) + shift * Math.PI * 2) * 0.4;
      points.push({
        x: t * f.width,
        y: f.height * layer.baseline - (band * 0.8 + roll * 0.35 + 0.2) * unit * layer.amplitude,
      });
    }

    ctx.save();
    ctx.fillStyle = layer.fill;
    ctx.beginPath();
    ctx.moveTo(0, f.height);
    smoothPath(ctx, points, false);
    ctx.lineTo(f.width, f.height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  /**
   * Telegraph poles with sagging wires. The sag is a real catenary-ish curve;
   * the treble adds a standing vibration on top, which is the only fast motion
   * in the theme and reads as a plucked string.
   */
  _wires(ctx, f, unit) {
    const baseY = f.height * 0.72;
    const height = unit * 0.2;
    const gap = f.width / (this.poles - 1);
    const twang = f.treble * unit * 0.02;

    ctx.save();
    ctx.strokeStyle = '#241309';
    ctx.lineCap = 'round';

    for (let p = 0; p < this.poles; p += 1) {
      const x = p * gap + Math.sin(f.time * 0.05 + p) * unit * 0.002;
      ctx.lineWidth = Math.max(1.2, unit * 0.007);
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x, baseY - height);
      ctx.stroke();

      ctx.lineWidth = Math.max(1, unit * 0.005);
      ctx.beginPath();
      ctx.moveTo(x - unit * 0.026, baseY - height * 0.86);
      ctx.lineTo(x + unit * 0.026, baseY - height * 0.86);
      ctx.stroke();

      if (p === this.poles - 1) continue;

      ctx.lineWidth = Math.max(0.8, unit * 0.0022);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        for (let i = 0; i <= 16; i += 1) {
          const t = i / 16;
          const wx = x + side * unit * 0.02 + t * gap;
          const sag = Math.sin(t * Math.PI) * unit * 0.03;
          const shake = Math.sin(t * Math.PI * 3 + f.time * 11 + p) * twang * Math.sin(t * Math.PI);
          const wy = baseY - height * 0.86 + sag + shake;
          if (i === 0) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  },
};
