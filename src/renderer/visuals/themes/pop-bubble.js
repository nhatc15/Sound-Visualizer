'use strict';

import { hashNoise, resample, samplePalette, withGlow } from '../draw-utils.js';
import { verticalWash, radialWash, bandRange } from './theme-utils.js';

/** Bubblegum ramp: hot pink through violet to sherbet yellow. */
const CANDY = [[0, '#ff5fa2'], [0.35, '#ff8ede'], [0.68, '#4fe0ff'], [1, '#ffd93d']];

/**
 * Pop — glossy and round, everything on a beat. The spectrum wraps a ring so
 * there is no left-to-right "chart" reading; it is a badge that pulses.
 *
 * Bass inflates the centre bubble, the ring carries the spectrum, and glitter
 * rises continuously but only catches the light on a hit.
 */
export const popBubble = {
  id: 'pop-bubble',
  name: 'Bubblegum',
  background: '#2a0b3a',
  ringSlots: 76,
  glitter: 34,

  draw(ctx, f) {
    const unit = Math.min(f.width, f.height);
    const cx = f.width / 2;
    const cy = f.height / 2;

    verticalWash(ctx, f, [
      [0, '#3d0f52'],
      [0.55, '#2a0b3a'],
      [1, '#16062a'],
    ]);
    radialWash(ctx, f, cx, cy, unit * 0.7, [
      [0, `rgba(255,95,162,${0.12 + f.levelSmooth * 0.22})`],
      [1, 'rgba(255,95,162,0)'],
    ]);

    this._glitter(ctx, f, unit);
    this._ring(ctx, f, cx, cy, unit);
    this._bubble(ctx, f, cx, cy, unit);
  },

  /**
   * Spectrum as rounded spokes around the ring. Round caps and a gap between
   * spokes keep it reading as candy rather than as a bar chart bent in a
   * circle; the slow rotation stops the low end from parking at one clock
   * position and looking like a defect.
   */
  _ring(ctx, f, cx, cy, unit) {
    const levels = resample(f.bands, this.ringSlots);
    const inner = unit * 0.19;
    const spoke = ((Math.PI * 2) / this.ringSlots) * inner * 0.62;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, spoke);
    // One glow for the whole ring. Per-spoke shadows looked identical and cost
    // 76 blurred strokes a cell, which a 3x3 grid turns into 684.
    withGlow(ctx, '#ff5fa2', unit * 0.03, () => {
      for (let i = 0; i < this.ringSlots; i += 1) {
        const t = i / this.ringSlots;
        const angle = t * Math.PI * 2 + f.time * 0.09 - Math.PI / 2;
        // The beat lengthens every spoke a little, which is what makes pop
        // bars feel sprung rather than plotted.
        const length = unit * (0.035 + levels[i] * (0.2 + f.beat * 0.05));
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        ctx.strokeStyle = samplePalette(CANDY, t);
        ctx.beginPath();
        ctx.moveTo(cx + cos * inner, cy + sin * inner);
        ctx.lineTo(cx + cos * (inner + length), cy + sin * (inner + length));
        ctx.stroke();
      }
    });
    ctx.restore();
  },

  /** Centre bubble: fill, rim, and one offset highlight so it reads glossy. */
  _bubble(ctx, f, cx, cy, unit) {
    const radius = unit * (0.13 + bandRange(f.bands, 0, 0.15) * 0.05 + f.beat * 0.012);

    const body = ctx.createRadialGradient(
      cx - radius * 0.35,
      cy - radius * 0.4,
      radius * 0.1,
      cx,
      cy,
      radius
    );
    body.addColorStop(0, '#ffe6f4');
    body.addColorStop(0.45, '#ff8ede');
    body.addColorStop(1, '#c62b8a');

    ctx.save();
    ctx.fillStyle = body;
    withGlow(ctx, '#ff5fa2', unit * 0.09, () => {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = Math.max(1, unit * 0.004);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Specular blob, kept small and high-left; a big one flattens the sphere.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(
      cx - radius * 0.34,
      cy - radius * 0.42,
      radius * 0.2,
      radius * 0.13,
      -0.6,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  },

  /**
   * Glitter drifting up the frame. Each piece has its own speed and phase from
   * the hash, so the field never needs storing; the beat only changes how
   * brightly they read, which is what ties them to the music.
   */
  _glitter(ctx, f, unit) {
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < this.glitter; i += 1) {
      const speed = 0.03 + hashNoise(i, 21) * 0.06;
      const life = (hashNoise(i, 22) + f.time * speed) % 1;
      const x = hashNoise(i, 23) * f.width + Math.sin(f.time * 0.8 + i) * unit * 0.02;
      const y = (1 - life) * f.height;
      const size = unit * (0.006 + hashNoise(i, 24) * 0.01) * (0.7 + f.beat * 0.8);
      const fade = Math.sin(life * Math.PI);

      ctx.globalAlpha = fade * (0.35 + f.beat * 0.5);
      if (i % 3 === 0) {
        ctx.fillStyle = samplePalette(CANDY, hashNoise(i, 25));
        ctx.beginPath();
        ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Four-point sparkle: two crossed strokes read as a glint at any size,
        // where a star polygon turns to mush below a few pixels.
        ctx.strokeStyle = '#fff6fb';
        ctx.lineWidth = Math.max(0.8, size * 0.28);
        ctx.beginPath();
        ctx.moveTo(x - size, y);
        ctx.lineTo(x + size, y);
        ctx.moveTo(x, y - size);
        ctx.lineTo(x, y + size);
        ctx.stroke();
      }
    }
    ctx.restore();
  },
};
