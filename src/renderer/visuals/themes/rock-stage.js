'use strict';

import { hashNoise, withGlow } from '../draw-utils.js';
import { radialWash, vignette, bandRange } from './theme-utils.js';

/**
 * Rock — a blown speaker cabinet under stage lights. Hard edges everywhere:
 * the waveform is drawn as raw straight segments with no smoothing, split into
 * red and cyan copies the way a badly registered print or a cheap camera does.
 *
 * The kick drives the violence: the frame jolts, the stage flashes white, and
 * the guitar strings across the cabinet snap.
 */
export const rockStage = {
  id: 'rock-stage',
  name: 'Stage Amp',
  background: '#0a0708',
  wavePoints: 128,
  strings: 6,

  draw(ctx, f) {
    const unit = Math.min(f.width, f.height);
    // Jolt on the kick. The offset is hashed off the frame index rather than
    // random, so it is a jolt in a fixed direction per frame instead of a blur.
    const jolt = f.beat * f.beat * unit * 0.014;
    const frame = Math.floor(f.time * 60);

    ctx.save();
    ctx.translate(
      (hashNoise(frame, 1) - 0.5) * jolt * 2,
      (hashNoise(frame, 2) - 0.5) * jolt * 2
    );

    this._cabinet(ctx, f, unit);
    this._strings(ctx, f, unit);
    this._wave(ctx, f, unit);
    this._sparks(ctx, f, unit);

    ctx.restore();

    // Flash sits outside the translate: a strobe that moved with the shake
    // would show its own edges against the cell border.
    if (f.beat > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${f.beat * f.beat * 0.16})`;
      ctx.fillRect(0, 0, f.width, f.height);
    }
    vignette(ctx, f, 0.7);
  },

  /** Black cabinet, red backlight behind it, woven grille cloth in front. */
  _cabinet(ctx, f, unit) {
    ctx.fillStyle = '#0a0708';
    ctx.fillRect(0, 0, f.width, f.height);
    radialWash(ctx, f, f.width / 2, f.height * 0.55, unit * 0.85, [
      [0, `rgba(255,34,51,${0.16 + bandRange(f.bands, 0, 0.16) * 0.4})`],
      [1, 'rgba(255,34,51,0)'],
    ]);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    const step = Math.max(6, unit * 0.035);
    for (let x = -f.height; x < f.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + f.height, f.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + f.height, 0);
      ctx.lineTo(x, f.height);
      ctx.stroke();
    }
    ctx.restore();
  },

  /**
   * Six strings across the cabinet, thick to thin. Each vibrates at its own
   * spatial frequency, driven by the mid register where guitars actually live.
   */
  _strings(ctx, f, unit) {
    const drive = bandRange(f.bands, 0.2, 0.62);
    ctx.save();
    ctx.lineCap = 'round';
    for (let s = 0; s < this.strings; s += 1) {
      const t = s / (this.strings - 1);
      const baseY = f.height * (0.2 + t * 0.6);
      const amp = unit * (0.02 + drive * 0.05) * (1 - t * 0.5);
      const waves = 2 + s * 1.4;
      ctx.strokeStyle = `rgba(255,122,26,${0.16 + drive * 0.3})`;
      ctx.lineWidth = Math.max(0.8, unit * 0.006 * (1 - t * 0.6));
      ctx.beginPath();
      for (let i = 0; i <= 48; i += 1) {
        const x = (i / 48) * f.width;
        const envelope = Math.sin((i / 48) * Math.PI);
        const y = baseY + Math.sin((i / 48) * Math.PI * waves + f.time * (5 + s)) * amp * envelope;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  },

  /**
   * The waveform, three times over: red pushed left, cyan pushed right, white
   * dead centre on top. Screen blending makes the overlaps go white where the
   * copies agree, so the split only shows on fast movement.
   */
  _wave(ctx, f, unit) {
    const samples = f.waveform.length;
    const mid = f.height / 2;
    const amplitude = f.height * 0.3 * (1 + bandRange(f.bands, 0, 0.16) * 0.5);
    const split = unit * (0.006 + f.beat * 0.016);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';

    const passes = [
      [-split, '#ff2233', unit * 0.009],
      [split, '#12d6ff', unit * 0.009],
      [0, '#ffffff', unit * 0.005],
    ];

    for (const [dx, color, width] of passes) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, width);
      withGlow(ctx, color, unit * 0.05, () => {
        ctx.beginPath();
        for (let i = 0; i < this.wavePoints; i += 1) {
          const x = (i / (this.wavePoints - 1)) * f.width + dx;
          // Read the waveform directly rather than through resample(), which
          // takes a maximum and so would throw away every trough.
          const value = f.waveform[Math.floor((i / this.wavePoints) * samples)];
          const y = mid - value * amplitude;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
    }
    ctx.restore();
  },

  /** Shards thrown off the top and bottom edges on a hit. */
  _sparks(ctx, f, unit) {
    if (f.beat < 0.1) return;
    const frame = Math.floor(f.time * 12);
    ctx.save();
    ctx.strokeStyle = '#ffd21e';
    ctx.lineWidth = Math.max(1, unit * 0.004);
    ctx.globalAlpha = f.beat * 0.8;
    for (let i = 0; i < 10; i += 1) {
      const x = hashNoise(i, frame) * f.width;
      const fromTop = hashNoise(i, frame + 7) > 0.5;
      const length = unit * (0.02 + hashNoise(i, frame + 3) * 0.07) * f.beat;
      const y = fromTop ? 0 : f.height;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (hashNoise(i, frame + 5) - 0.5) * length, fromTop ? y + length : y - length);
      ctx.stroke();
    }
    ctx.restore();
  },
};
