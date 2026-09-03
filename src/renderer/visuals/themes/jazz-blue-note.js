'use strict';

import { gradient, withGlow, smoothPath, resample } from '../draw-utils.js';
import { verticalWash, radialWash, speckField, vignette, bandRange } from './theme-utils.js';

/** Brass ramp for the ribbon: bell highlight through lacquer to shadow. */
const BRASS = [[0, '#f8e3ad'], [0.4, '#f0b429'], [0.78, '#c2661d'], [1, '#7a3312']];

/**
 * Jazz — a dim club, not a light show. Everything is warm brass over brown,
 * moves slowly, and stays off the edges of the frame.
 *
 * Bass swells the body of an upright bass in the corner, mids draw the brass
 * ribbon curling across the room, treble lands as brushed-cymbal grain along
 * the ceiling. The whole thing sits under vinyl dust.
 */
export const jazzBlueNote = {
  id: 'jazz-bluenote',
  name: 'Blue Note',
  background: '#160f0c',
  cymbalSlots: 52,

  draw(ctx, f) {
    const unit = Math.min(f.width, f.height);

    this._room(ctx, f, unit);
    this._spotlight(ctx, f);
    this._bassBody(ctx, f, unit);
    this._ribbon(ctx, f, unit);
    this._cymbalGrain(ctx, f, unit);
    speckField(ctx, f, {
      count: 70,
      color: '#f4dfb0',
      alpha: 0.2,
      radius: unit * 0.004,
      driftY: -0.012,
      driftX: 0.004,
      seed: 12,
    });
    vignette(ctx, f, 0.6);
  },

  /** Brown room with a teal cast in the corners, the Blue Note sleeve look. */
  _room(ctx, f, unit) {
    verticalWash(ctx, f, [
      [0, '#2a1a0d'],
      [0.5, '#191110'],
      [1, '#0c0b10'],
    ]);
    radialWash(ctx, f, f.width * 0.85, f.height * 0.9, unit * 0.8, [
      [0, 'rgba(27,58,75,0.5)'],
      [1, 'rgba(27,58,75,0)'],
    ]);
  },

  /**
   * Cone from a lamp just off the top of the frame. Its opacity rides the
   * smoothed level rather than the raw one — a spotlight that flickered on
   * every transient would read as a fault, not as a room.
   */
  _spotlight(ctx, f) {
    const strength = 0.1 + f.levelSmooth * 0.3;
    const grad = ctx.createLinearGradient(0, 0, 0, f.height);
    grad.addColorStop(0, `rgba(248,227,173,${strength})`);
    grad.addColorStop(0.6, `rgba(240,180,41,${strength * 0.25})`);
    grad.addColorStop(1, 'rgba(240,180,41,0)');

    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(f.width * 0.42, -f.height * 0.05);
    ctx.lineTo(f.width * 0.58, -f.height * 0.05);
    ctx.lineTo(f.width * 0.95, f.height);
    ctx.lineTo(f.width * 0.05, f.height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  /**
   * Upright bass body: nested ellipses that breathe on the low register. Kept
   * to an outline — a filled shape at this size reads as a blob, while three
   * rings read as a resonating box.
   */
  _bassBody(ctx, f, unit) {
    const cx = f.width * 0.19;
    const cy = f.height * 0.74;
    const swell = bandRange(f.bands, 0, 0.14);
    ctx.save();
    ctx.lineWidth = Math.max(1.2, unit * 0.005);
    withGlow(ctx, '#c2661d', unit * 0.06, () => {
      for (let ring = 0; ring < 3; ring += 1) {
        const scale = 1 + ring * 0.42 + swell * 0.5;
        ctx.strokeStyle = `rgba(240,180,41,${0.5 - ring * 0.13})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, unit * 0.075 * scale, unit * 0.1 * scale, -0.22, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    ctx.restore();
  },

  /**
   * The melody line. Two passes of the same waveform, the second read at an
   * offset and drawn faint, which lands as the note that just decayed still
   * hanging in the room.
   */
  _ribbon(ctx, f, unit) {
    const samples = f.waveform.length;
    const mid = f.height * 0.5;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (const pass of [1, 0]) {
      const offset = pass === 0 ? 0 : Math.round(samples * 0.05);
      const amplitude = f.height * (pass === 0 ? 0.24 : 0.19);
      const points = [];
      for (let i = 0; i < samples; i += 1) {
        const value = f.waveform[(i + offset) % samples];
        const lean = Math.sin((i / samples) * Math.PI) * unit * 0.05;
        points.push({
          x: (i / (samples - 1)) * f.width,
          y: mid - value * amplitude - (pass === 0 ? lean : -lean * 0.6),
        });
      }

      ctx.globalAlpha = pass === 0 ? 1 : 0.28;
      ctx.strokeStyle = gradient(ctx, BRASS, [0, 0, f.width, f.height]);
      ctx.lineWidth = Math.max(1.6, unit * (pass === 0 ? 0.012 : 0.006));
      withGlow(ctx, '#f0b429', unit * 0.07, () => {
        ctx.beginPath();
        smoothPath(ctx, points);
        ctx.stroke();
      });
    }
    ctx.globalAlpha = 1;
  },

  /**
   * Brushed cymbal: cream grain along the ceiling whose density follows the
   * top of the spectrum. Drawn as short strokes rather than dots so it reads
   * as a brush being dragged.
   */
  _cymbalGrain(ctx, f, unit) {
    const levels = resample(f.bands, this.cymbalSlots);
    const slot = f.width / this.cymbalSlots;
    const shimmer = 0.35 + f.treble * 0.65;

    ctx.save();
    ctx.strokeStyle = '#e9dcc3';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.8, unit * 0.003);
    for (let i = 0; i < this.cymbalSlots; i += 1) {
      const value = levels[i];
      if (value < 0.04) continue;
      const x = (i + 0.5) * slot;
      const length = unit * 0.012 + value * unit * 0.07;
      const y = f.height * 0.14 + Math.sin(i * 0.7 + f.time * 0.6) * unit * 0.012;
      ctx.globalAlpha = Math.min(0.75, value * shimmer);
      ctx.beginPath();
      ctx.moveTo(x, y - length / 2);
      ctx.lineTo(x + length * 0.35, y + length / 2);
      ctx.stroke();
    }
    ctx.restore();
  },
};
