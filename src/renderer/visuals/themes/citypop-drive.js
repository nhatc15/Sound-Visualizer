'use strict';

import { hashNoise, resample, withGlow } from '../draw-utils.js';
import { verticalWash, speckField, scanlines, firstCellOfFrame, bandRange } from './theme-utils.js';

/** Sky stops, reused for the slits cut through the sun so they read as gaps. */
const SKY = [
  [0, '#150a37'],
  [0.3, '#4b1668'],
  [0.62, '#ff2e88'],
  [0.86, '#ff8a3d'],
  [1, '#ffd76e'],
];

/**
 * City Pop — the 1980s Japanese record sleeve: a slitted sun over a chrome
 * horizon, a skyline of tower blocks, and a grid road running under the car.
 *
 * The spectrum is spent on the skyline and on the width of the slits across
 * the sun. Road speed follows the smoothed level, so the drive accelerates
 * into a chorus.
 */
export const cityPopDrive = {
  id: 'citypop-drive',
  name: 'Midnight Drive',
  background: '#12062a',
  towers: 30,
  slits: 9,
  roadLines: 13,

  draw(ctx, f) {
    const unit = Math.min(f.width, f.height);
    const horizon = f.height * 0.56;

    // One accumulator for the whole frame: nine grid cells calling this preset
    // must not advance the road nine times.
    if (firstCellOfFrame(this, f)) {
      this._scroll = ((this._scroll ?? 0) + f.dt * (0.09 + f.levelSmooth * 0.55)) % 1;
    }

    verticalWash(ctx, f, SKY);
    speckField(ctx, f, { count: 60, color: '#fff3d1', alpha: 0.5, radius: unit * 0.0035, seed: 31 });
    this._sun(ctx, f, unit, horizon);
    this._skyline(ctx, f, unit, horizon);
    this._road(ctx, f, unit, horizon);
    this._horizonGlow(ctx, f, unit, horizon);
    scanlines(ctx, f, Math.max(1, Math.round(unit * 0.004)), 0.1);
  },

  /**
   * Sun disc with horizontal slits. The slits are painted with the same sky
   * gradient the disc sits on, so they read as the disc being cut through
   * rather than as dark stripes laid over it; their heights come from the mid
   * register, which makes the sun appear to dissolve on loud passages.
   */
  _sun(ctx, f, unit, horizon) {
    const cx = f.width * 0.5;
    const cy = horizon - unit * 0.04;
    const radius = unit * 0.2;

    const disc = ctx.createLinearGradient(0, cy - radius, 0, cy + radius);
    disc.addColorStop(0, '#fff0a8');
    disc.addColorStop(0.45, '#ffb03d');
    disc.addColorStop(1, '#ff2e88');

    ctx.save();
    ctx.fillStyle = disc;
    withGlow(ctx, '#ff5fa2', unit * 0.12, () => {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    const sky = ctx.createLinearGradient(0, 0, 0, f.height);
    for (const [offset, color] of SKY) sky.addColorStop(offset, color);
    ctx.fillStyle = sky;

    const levels = resample(f.bands, this.slits);
    for (let i = 0; i < this.slits; i += 1) {
      // Slits crowd toward the bottom of the disc, the way the reference
      // sleeves cut them: sparse at the top, banded near the horizon.
      const t = (i + 1) / (this.slits + 1);
      const y = cy - radius * 0.35 + t * radius * 1.3;
      const height = radius * (0.02 + levels[i] * 0.12);
      ctx.fillRect(cx - radius, y, radius * 2, height);
    }
    ctx.restore();
  },

  /** Tower blocks at the horizon, heights from the spectrum, lit windows. */
  _skyline(ctx, f, unit, horizon) {
    const levels = resample(f.bands, this.towers);
    const slot = f.width / this.towers;

    ctx.save();
    for (let i = 0; i < this.towers; i += 1) {
      const height = unit * (0.02 + levels[i] * 0.19);
      const x = i * slot;
      ctx.fillStyle = '#1b0b2e';
      ctx.fillRect(x, horizon - height, slot * 0.86, height);

      // Windows only above a floor's worth of height, otherwise short blocks
      // turn into a row of loose dots with no building under them.
      if (height < unit * 0.05) continue;
      ctx.fillStyle = `rgba(255,215,110,${0.25 + levels[i] * 0.5})`;
      const rows = Math.floor(height / (unit * 0.022));
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < 2; c += 1) {
          if (hashNoise(i * 31 + r * 7 + c, 5) < 0.42) continue;
          ctx.fillRect(
            x + slot * (0.18 + c * 0.4),
            horizon - height + unit * 0.008 + r * unit * 0.022,
            slot * 0.2,
            unit * 0.008
          );
        }
      }
    }
    ctx.restore();
  },

  /**
   * Perspective road. Horizontal lines are spaced by a squared parameter so
   * they bunch at the horizon, and the scroll offset moves through that same
   * curve — which is why the road appears to rush rather than slide.
   */
  _road(ctx, f, unit, horizon) {
    const depth = f.height - horizon;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizon, f.width, depth);
    ctx.clip();

    ctx.fillStyle = '#0e0426';
    ctx.fillRect(0, horizon, f.width, depth);

    ctx.lineWidth = Math.max(1, unit * 0.0035);
    ctx.strokeStyle = '#12d6ff';

    for (let i = 0; i < this.roadLines; i += 1) {
      const t = ((i + this._scroll) / this.roadLines) ** 2.3;
      const y = horizon + t * depth * 1.05;
      ctx.globalAlpha = 0.12 + t * 0.55;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(f.width, y);
      ctx.stroke();
    }

    // Verticals converge on the vanishing point, fanned wider than the frame
    // so the outermost pair still crosses the bottom edge.
    ctx.globalAlpha = 0.4;
    for (let i = -7; i <= 7; i += 1) {
      ctx.beginPath();
      ctx.moveTo(f.width / 2, horizon);
      ctx.lineTo(f.width / 2 + i * f.width * 0.19, f.height);
      ctx.stroke();
    }
    ctx.restore();
  },

  /** Chrome strip where sky meets road; brightens with the low end. */
  _horizonGlow(ctx, f, unit, horizon) {
    const lift = bandRange(f.bands, 0, 0.2);
    ctx.save();
    ctx.strokeStyle = '#bff6ff';
    ctx.lineWidth = Math.max(1.4, unit * (0.004 + lift * 0.006));
    withGlow(ctx, '#12d6ff', unit * (0.06 + lift * 0.1), () => {
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      ctx.lineTo(f.width, horizon);
      ctx.stroke();
    });
    ctx.restore();
  },
};
