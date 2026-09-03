'use strict';

import { resample, roundedRect, withGlow } from '../draw-utils.js';
import { radialWash, firstCellOfFrame, bandRange } from './theme-utils.js';

/**
 * Hip hop — the record and the meter. Analogue hardware rather than light: a
 * turntable on the left, a needle VU on the right, and a halftone dot field
 * behind them standing in for the print texture of a record sleeve.
 *
 * The needle is deliberately slow. A VU that tracked the signal exactly would
 * read as a bar chart; the lag is the instrument.
 */
export const hipHopBoomBap = {
  id: 'hiphop-boombap',
  name: 'Boom Bap',
  background: '#0d0b08',
  dotCols: 26,
  dotRows: 13,
  beads: 26,

  draw(ctx, f) {
    const unit = Math.min(f.width, f.height);
    const bass = bandRange(f.bands, 0, 0.16);

    if (firstCellOfFrame(this, f)) {
      this._platter = (this._platter ?? 0) + f.dt * 2.2;
      // Ballistic needle: chases the level at a fixed rate, so a transient
      // sends it swinging and it falls back slowly, like a real meter.
      this._needle ??= 0;
      this._needle += (f.level - this._needle) * Math.min(1, f.dt * 6);
    }

    ctx.fillStyle = '#0d0b08';
    ctx.fillRect(0, 0, f.width, f.height);
    radialWash(ctx, f, f.width / 2, f.height / 2, unit * 0.8, [
      [0, `rgba(255,201,60,${0.06 + bass * 0.16})`],
      [1, 'rgba(255,201,60,0)'],
    ]);

    this._halftone(ctx, f, unit);
    this._kickBand(ctx, f, unit, bass);
    this._turntable(ctx, f, unit, bass);
    this._vuMeter(ctx, f, unit);
    this._beadChain(ctx, f, unit);
  },

  /**
   * Halftone: a fixed grid where only the dot radius moves. Column drives the
   * band, row fades outward from the middle, so loud bands bloom into columns
   * of large dots instead of the field flashing as a whole.
   */
  _halftone(ctx, f, unit) {
    const levels = resample(f.bands, this.dotCols);
    const cellW = f.width / this.dotCols;
    const cellH = f.height / this.dotRows;
    const maxRadius = Math.min(cellW, cellH) * 0.42;

    ctx.save();
    ctx.fillStyle = '#ffc93c';
    for (let col = 0; col < this.dotCols; col += 1) {
      for (let row = 0; row < this.dotRows; row += 1) {
        const fromCentre = Math.abs(row / (this.dotRows - 1) - 0.5) * 2;
        const strength = levels[col] * (1 - fromCentre * 0.75);
        if (strength < 0.03) continue;
        ctx.globalAlpha = 0.1 + strength * 0.35;
        ctx.beginPath();
        ctx.arc(
          (col + 0.5) * cellW,
          (row + 0.5) * cellH,
          maxRadius * Math.min(1, strength * 1.6),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
    ctx.restore();
  },

  /** Wide bar across the middle that snaps open on the kick. */
  _kickBand(ctx, f, unit, bass) {
    const height = unit * (0.004 + f.beat * 0.05 + bass * 0.01);
    const grad = ctx.createLinearGradient(0, 0, f.width, 0);
    grad.addColorStop(0, 'rgba(255,87,34,0)');
    grad.addColorStop(0.5, `rgba(255,201,60,${0.25 + f.beat * 0.5})`);
    grad.addColorStop(1, 'rgba(255,87,34,0)');

    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, f.height / 2 - height / 2, f.width, height);
    ctx.restore();
  },

  /** Vinyl: grooves, gold label, and one mark so the rotation is visible. */
  _turntable(ctx, f, unit, bass) {
    const cx = f.width * 0.28;
    const cy = f.height * 0.54;
    const radius = unit * (0.2 + bass * 0.012);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this._platter ?? 0);

    ctx.fillStyle = '#0a0806';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(245,230,200,0.14)';
    ctx.lineWidth = Math.max(0.5, unit * 0.0015);
    for (let i = 1; i <= 9; i += 1) {
      ctx.beginPath();
      ctx.arc(0, 0, radius * (0.36 + i * 0.068), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#ffc93c';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0d0b08';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.045, 0, Math.PI * 2);
    ctx.fill();

    // Single dark stripe on the label; without it the platter spins invisibly.
    ctx.fillStyle = 'rgba(13,11,8,0.6)';
    ctx.fillRect(radius * 0.34, -radius * 0.012, radius * 0.6, radius * 0.024);
    ctx.restore();
  },

  /** Needle meter: arc scale, red zone at the top, gold pointer. */
  _vuMeter(ctx, f, unit) {
    const cx = f.width * 0.74;
    const cy = f.height * 0.66;
    const radius = unit * 0.24;
    const from = -Math.PI * 0.78;
    const to = -Math.PI * 0.22;

    ctx.save();
    ctx.fillStyle = 'rgba(245,230,200,0.06)';
    roundedRect(ctx, cx - radius * 1.1, cy - radius * 1.05, radius * 2.2, radius * 1.4, radius * 0.1);
    ctx.fill();

    ctx.lineWidth = Math.max(1, unit * 0.004);
    ctx.strokeStyle = 'rgba(245,230,200,0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.86, from, to);
    ctx.stroke();

    ctx.strokeStyle = '#ff5722';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.86, from + (to - from) * 0.72, to);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(245,230,200,0.5)';
    ctx.lineWidth = Math.max(0.8, unit * 0.0022);
    for (let i = 0; i <= 10; i += 1) {
      const angle = from + ((to - from) * i) / 10;
      const long = i % 5 === 0;
      const inner = radius * (long ? 0.7 : 0.78);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * radius * 0.86, cy + Math.sin(angle) * radius * 0.86);
      ctx.stroke();
    }

    // Scaled so an ordinary mix sits mid-dial and only a loud one pins it.
    const swing = Math.min(1, (this._needle ?? 0) * 1.9);
    const angle = from + (to - from) * swing;
    ctx.strokeStyle = '#ffc93c';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.4, unit * 0.006);
    withGlow(ctx, '#ffc93c', unit * 0.04, () => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * radius * 0.82, cy + Math.sin(angle) * radius * 0.82);
      ctx.stroke();
    });

    ctx.fillStyle = '#f5e6c8';
    ctx.beginPath();
    ctx.arc(cx, cy, unit * 0.009, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  /** Peak markers along the bottom as a chain of beads. */
  _beadChain(ctx, f, unit) {
    const peaks = resample(f.peaks, this.beads);
    const slot = f.width / this.beads;
    const y = f.height * 0.94;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,201,60,0.35)';
    ctx.lineWidth = Math.max(0.8, unit * 0.002);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(f.width, y);
    ctx.stroke();

    for (let i = 0; i < this.beads; i += 1) {
      const radius = slot * (0.12 + peaks[i] * 0.3);
      const bead = ctx.createRadialGradient(
        (i + 0.5) * slot - radius * 0.3,
        y - radius * 0.3,
        radius * 0.1,
        (i + 0.5) * slot,
        y,
        radius
      );
      bead.addColorStop(0, '#fff3cd');
      bead.addColorStop(0.6, '#ffc93c');
      bead.addColorStop(1, '#a86a12');
      ctx.fillStyle = bead;
      ctx.beginPath();
      ctx.arc((i + 0.5) * slot, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
};
