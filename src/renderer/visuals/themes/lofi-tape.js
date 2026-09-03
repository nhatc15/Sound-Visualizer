'use strict';

import { hashNoise, resample, roundedRect } from '../draw-utils.js';
import { verticalWash, radialWash, speckField, firstCellOfFrame, bandRange } from './theme-utils.js';

/**
 * Lo-fi — a cassette on a desk by a window. Muted, warm, and slightly unwell:
 * the whole frame wobbles on a slow cycle the way a stretched tape does.
 *
 * The spectrum stays in the background as soft bars; the subject is the tape
 * itself, whose reels spin faster the louder the track and whose ribbon sags
 * and shivers with the waveform.
 */
export const lofiTape = {
  id: 'lofi-tape',
  name: 'Study Tape',
  background: '#241f1b',
  bars: 44,
  rain: 32,

  draw(ctx, f) {
    const unit = Math.min(f.width, f.height);

    if (firstCellOfFrame(this, f)) {
      // Reels keep their own angle: deriving it from time * level would jump
      // backwards whenever the level dropped.
      this._spin = (this._spin ?? 0) + f.dt * (0.7 + f.levelSmooth * 5);
    }

    verticalWash(ctx, f, [
      [0, '#2f2823'],
      [0.6, '#241f1b'],
      [1, '#1a1613'],
    ]);
    radialWash(ctx, f, f.width * 0.82, f.height * 0.18, unit * 0.7, [
      [0, 'rgba(217,184,163,0.28)'],
      [1, 'rgba(217,184,163,0)'],
    ]);

    this._bars(ctx, f, unit);
    this._rain(ctx, f, unit);

    ctx.save();
    // Tape wobble: a slow drift plus a faster flutter, both tiny. Large values
    // read as a broken renderer rather than as worn tape.
    ctx.translate(
      Math.sin(f.time * 0.7) * unit * 0.004,
      Math.sin(f.time * 1.9) * unit * 0.003
    );
    this._cassette(ctx, f, unit);
    ctx.restore();

    speckField(ctx, f, { count: 150, color: '#f2e7d5', alpha: 0.07, radius: unit * 0.0022, seed: 51 });
  },

  /** Soft rounded bars low in the frame, well behind the subject. */
  _bars(ctx, f, unit) {
    const levels = resample(f.bands, this.bars);
    const slot = f.width / this.bars;

    ctx.save();
    ctx.globalAlpha = 0.32;
    for (let i = 0; i < this.bars; i += 1) {
      const height = f.height * (0.03 + levels[i] * 0.34);
      const mix = i / this.bars;
      ctx.fillStyle = mix < 0.5 ? '#8fa9a3' : '#d9b8a3';
      roundedRect(ctx, i * slot + slot * 0.2, f.height - height, slot * 0.6, height, slot * 0.3);
      ctx.fill();
    }
    ctx.restore();
  },

  /** Window rain: short slanted streaks, faster than anything else on screen. */
  _rain(ctx, f, unit) {
    ctx.save();
    ctx.strokeStyle = '#cfe0e6';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.7, unit * 0.0022);
    for (let i = 0; i < this.rain; i += 1) {
      const speed = 0.35 + hashNoise(i, 61) * 0.4;
      const y = ((hashNoise(i, 62) + f.time * speed) % 1) * f.height;
      const x = hashNoise(i, 63) * f.width;
      const length = unit * (0.03 + hashNoise(i, 64) * 0.04);
      ctx.globalAlpha = 0.1 + hashNoise(i, 65) * 0.14;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - length * 0.22, y + length);
      ctx.stroke();
    }
    ctx.restore();
  },

  /** Shell, window, two reels, and the ribbon strung between them. */
  _cassette(ctx, f, unit) {
    const width = unit * 0.62;
    const height = width * 0.62;
    const x = f.width / 2 - width / 2;
    const y = f.height / 2 - height / 2;
    const reelGap = width * 0.24;
    const reelRadius = width * 0.13;
    const cy = y + height * 0.44;

    ctx.save();
    ctx.fillStyle = '#d9b8a3';
    ctx.strokeStyle = '#f2e7d5';
    ctx.lineWidth = Math.max(1, unit * 0.003);
    roundedRect(ctx, x, y, width, height, width * 0.05);
    ctx.fill();
    ctx.stroke();

    // Paper label: two ruled lines, no text — a label with lorem on it would
    // be the only literal thing in the frame.
    ctx.fillStyle = '#f2e7d5';
    roundedRect(ctx, x + width * 0.1, y + height * 0.08, width * 0.8, height * 0.2, width * 0.02);
    ctx.fill();
    ctx.strokeStyle = 'rgba(58,45,38,0.35)';
    ctx.lineWidth = Math.max(0.8, unit * 0.0018);
    for (let line = 0; line < 2; line += 1) {
      const ly = y + height * (0.15 + line * 0.07);
      ctx.beginPath();
      ctx.moveTo(x + width * 0.16, ly);
      ctx.lineTo(x + width * (line === 0 ? 0.78 : 0.6), ly);
      ctx.stroke();
    }

    // Window
    ctx.fillStyle = 'rgba(26,22,19,0.85)';
    roundedRect(ctx, x + width * 0.12, y + height * 0.36, width * 0.76, height * 0.42, width * 0.03);
    ctx.fill();

    this._ribbon(ctx, f, unit, f.width / 2, cy, reelGap, reelRadius);
    for (const side of [-1, 1]) {
      this._reel(ctx, f.width / 2 + side * reelGap, cy, reelRadius, unit, side);
    }
    ctx.restore();
  },

  /** Hub, spokes, and the wound tape whose thickness follows the low end. */
  _reel(ctx, cx, cy, radius, unit, side) {
    const angle = this._spin * side;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    ctx.fillStyle = '#3a2d26';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#8fa9a3';
    ctx.lineWidth = Math.max(1, unit * 0.0035);
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * radius * 0.3, Math.sin(a) * radius * 0.3);
      ctx.lineTo(Math.cos(a) * radius * 0.82, Math.sin(a) * radius * 0.82);
      ctx.stroke();
    }

    ctx.fillStyle = '#f2e7d5';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  /**
   * The exposed span of tape. It hangs in a sag and the waveform rides on top
   * of it, which puts the actual signal in the middle of the subject rather
   * than in a separate widget.
   */
  _ribbon(ctx, f, unit, cx, cy, gap, radius) {
    const samples = f.waveform.length;
    const sag = radius * (0.5 - bandRange(f.bands, 0, 0.18) * 0.25);

    ctx.save();
    ctx.strokeStyle = '#4a3a30';
    ctx.lineWidth = Math.max(1.2, unit * 0.005);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 40; i += 1) {
      const t = i / 40;
      const x = cx - gap + t * gap * 2;
      const bow = Math.sin(t * Math.PI) * sag;
      const value = f.waveform[Math.floor(t * (samples - 1))];
      const y = cy + radius * 0.1 + bow + value * radius * 0.42 * Math.sin(t * Math.PI);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  },
};
