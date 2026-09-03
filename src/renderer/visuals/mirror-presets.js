'use strict';

import {
  PALETTES,
  gradient,
  withGlow,
  roundedRect,
  smoothPath,
  resample,
  hashNoise,
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
 * Eases between successive fixed noise fields, so a slot's character changes
 * over seconds instead of per frame. Frozen noise made the mark look like a
 * static logo; per-frame noise made it boil. This drifts.
 */
function driftNoise(index, seed, time, rate = 0.15) {
  const phase = time * rate + seed * 3.7;
  const step = Math.floor(phase);
  const mix = phase - step;
  const eased = mix * mix * (3 - 2 * mix);
  return (
    hashNoise(index, step + seed * 11) * (1 - eased) +
    hashNoise(index, step + 1 + seed * 11) * eased
  );
}

/**
 * The Tacet Mark: a vertical spindle of light that blooms out of the centre
 * and tapers to a point at both ends, ringed by orbiting circles and drifting
 * motes.
 *
 * Deliberately unlike the other presets. The silhouette is built from jagged
 * straight segments rather than smoothed curves, and the two sides come from
 * independent noise so it is never a mirror of itself — smoothed and
 * symmetric, this shape reads as a leaf rather than an emblem.
 */
const spindleWave = {
  id: 'spindle-wave',
  name: 'Tacet Mark',
  slots: 170,
  draw(ctx, f) {
    const cx = f.width / 2;
    const cy = f.height / 2;
    // Every dimension keys off the short edge, so the mark keeps its shape in
    // a wide single view and in a cramped grid cell alike.
    const unit = Math.min(f.width, f.height);
    const span = f.height * 0.96;
    const top = cy - span / 2;
    const levels = resample(f.bands, this.slots);

    this._ground(ctx, f, cx, cy, unit);
    this._rings(ctx, f, cx, cy, unit);
    this._motes(ctx, f, cx, cy, unit);
    this._mark(ctx, f, cx, cy, unit, top, span, levels);
  },

  /** Dark teal well behind the mark; the cyan glow needs somewhere to sit. */
  _ground(ctx, f, cx, cy, unit) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.8);
    g.addColorStop(0, 'rgba(20, 52, 60, 0.96)');
    g.addColorStop(0.55, 'rgba(10, 28, 36, 0.96)');
    g.addColorStop(1, 'rgba(4, 10, 16, 0.96)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, f.width, f.height);
  },

  _rings(ctx, f, cx, cy, unit) {
    // Rings breathe with the bass rather than the overall level, so they pulse
    // on the beat instead of tracking every cymbal.
    const pulse = 1 + f.bass * 0.07;
    const outer = unit * 0.4 * pulse;
    const inner = unit * 0.325 * pulse;
    const glow = Math.min(26, unit * 0.06);

    ctx.save();
    ctx.strokeStyle = 'rgba(126, 240, 255, 0.85)';
    ctx.lineWidth = Math.max(1.5, unit * 0.009);
    ctx.shadowColor = '#5fe6ff';
    ctx.shadowBlur = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, outer, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(216, 150, 76, 0.8)';
    ctx.lineWidth = Math.max(1, unit * 0.0035);
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Broken outer arc, turning slowly — a solid third ring made the emblem
    // look like a static badge.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(f.time * 0.11);
    ctx.strokeStyle = 'rgba(158, 214, 228, 0.34)';
    ctx.lineWidth = Math.max(1, unit * 0.005);
    ctx.setLineDash([unit * 0.028, unit * 0.052]);
    ctx.beginPath();
    ctx.arc(0, 0, unit * 0.465, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    this._orb(ctx, cx, cy, outer, f.time * 0.31 + 0.6, unit * 0.026, '#dff6ff', false, glow);
    this._orb(ctx, cx, cy, inner, -f.time * 0.23 + 3.4, unit * 0.019, '#f4d78c', true, glow);
  },

  /** A circle riding a ring: hollow on the bright ring, filled on the thin one. */
  _orb(ctx, cx, cy, radius, angle, size, colour, filled, glow) {
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    ctx.save();
    ctx.shadowColor = colour;
    ctx.shadowBlur = glow;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    if (filled) {
      ctx.fillStyle = colour;
      ctx.fill();
    } else {
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(1, size * 0.22);
      ctx.stroke();
    }
    ctx.restore();
  },

  /** Specks drifting on slow circular paths, brightened by the treble. */
  _motes(ctx, f, cx, cy, unit) {
    const count = 44;
    const lift = 0.5 + f.treble * 0.9;
    ctx.save();
    for (let i = 0; i < count; i += 1) {
      const angle =
        hashNoise(i, 5) * Math.PI * 2 + f.time * (0.04 + hashNoise(i, 6) * 0.09);
      const radius = unit * (0.16 + hashNoise(i, 7) * 0.36);
      const x = cx + Math.cos(angle) * radius * 1.4;
      const y = cy + Math.sin(angle) * radius;
      const size = Math.max(0.6, unit * 0.0045 * (0.35 + hashNoise(i, 8)));
      const alpha = (0.12 + 0.42 * hashNoise(i, 9)) * lift;
      ctx.fillStyle = 'rgba(206, 242, 252, ' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  /**
   * Per-slot reach multiplier with a heavy tail. Most slots hug the body
   * outline while a rare few shoot far past it: an even multiplier produced a
   * smooth blade, and it is the long needle beside short neighbours that makes
   * the mark read as struck rather than generated.
   */
  _reachFactor(index, seed, time) {
    const body = driftNoise(index, seed, time);
    const needle = driftNoise(index, seed + 40, time) ** 8;
    return 0.22 + 0.85 * body * body + 2.7 * needle;
  },

  _mark(ctx, f, cx, cy, unit, top, span, levels) {
    const slots = this.slots;
    // Sized against the rings, not the cell: the mark is a slim spindle that
    // sits inside them, with only the rare needle crossing. Scaled to the cell
    // it swelled into a filled ellipse and the rings disappeared behind it.
    const maxReach = Math.min(f.width * 0.44, unit * 0.38);
    const limit = Math.min(f.width * 0.47, unit * 0.44);

    const ys = new Array(slots);
    const right = new Array(slots);
    const left = new Array(slots);

    for (let i = 0; i < slots; i += 1) {
      const t = slots === 1 ? 0.5 : i / (slots - 1);
      ys[i] = top + t * span;
      // Lens envelope: this is what makes the spikes bloom out of the middle
      // and shrink to nothing at the tips.
      const envelope = Math.sin(Math.PI * t) ** 1.15;
      const body = envelope * (0.08 + 0.92 * levels[i]) * maxReach;
      right[i] = Math.min(limit, body * this._reachFactor(i, 1, f.time));
      left[i] = Math.min(limit, body * this._reachFactor(i, 2, f.time));
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, top);
    for (let i = 0; i < slots; i += 1) ctx.lineTo(cx + right[i], ys[i]);
    ctx.lineTo(cx, top + span);
    for (let i = slots - 1; i >= 0; i -= 1) ctx.lineTo(cx - left[i], ys[i]);
    ctx.closePath();

    const body = ctx.createLinearGradient(0, top, 0, top + span);
    body.addColorStop(0, 'rgba(255, 224, 148, 0.95)');
    body.addColorStop(0.33, 'rgba(224, 255, 246, 0.98)');
    body.addColorStop(0.5, '#ffffff');
    body.addColorStop(0.67, 'rgba(206, 250, 255, 0.98)');
    body.addColorStop(1, 'rgba(255, 212, 130, 0.95)');
    ctx.fillStyle = body;
    ctx.shadowColor = 'rgba(150, 245, 255, 0.9)';
    ctx.shadowBlur = Math.min(30, unit * 0.085);
    ctx.fill();
    ctx.restore();

    // Blown-out core along the axis, fading to nothing at both tips.
    ctx.save();
    const core = ctx.createLinearGradient(0, top, 0, top + span);
    const heat = (0.5 + 0.5 * f.levelSmooth).toFixed(3);
    core.addColorStop(0, 'rgba(255, 255, 255, 0)');
    core.addColorStop(0.5, 'rgba(255, 255, 255, ' + heat + ')');
    core.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = core;
    ctx.lineWidth = Math.max(1.5, unit * 0.011 * (0.6 + f.levelSmooth));
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = Math.min(26, unit * 0.07);
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, top + span);
    ctx.stroke();
    ctx.restore();

    // Hot centre, so the widest part of the spindle is also the brightest.
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.24);
    const peak = (0.22 + 0.4 * f.levelSmooth).toFixed(3);
    bloom.addColorStop(0, 'rgba(255, 255, 255, ' + peak + ')');
    bloom.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(cx - unit * 0.24, cy - unit * 0.24, unit * 0.48, unit * 0.48);
  },
};

export const mirrorPresets = [envelopeBlob, dualMirror, smoothHills, spindleWave];
