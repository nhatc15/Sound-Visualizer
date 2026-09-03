'use strict';

import { resample, withGlow } from '../draw-utils.js';
import { radialWash, polygonPath, firstCellOfFrame, bandRange } from './theme-utils.js';

/** Rings live in normalised radius, so one list serves every cell size. */
const RING_SPEED = 1.15; // screens per second
const RING_LIMIT = 1.35;

/**
 * EDM — a club rig seen head on. Lasers fan out of the centre, the kick throws
 * a shockwave ring, and the tunnel behind everything recedes toward the drop.
 *
 * This is the one theme that keeps simulation state: rings have to outlive the
 * frame that spawned them. It is advanced once per frame, not once per cell.
 */
export const edmDrop = {
  id: 'edm-drop',
  name: 'Drop Core',
  background: '#050208',
  beams: 20,
  tunnel: 9,

  draw(ctx, f) {
    const unit = Math.min(f.width, f.height);
    const cx = f.width / 2;
    const cy = f.height / 2;
    const bass = bandRange(f.bands, 0, 0.16);

    if (firstCellOfFrame(this, f)) this._advanceRings(f);

    ctx.fillStyle = '#050208';
    ctx.fillRect(0, 0, f.width, f.height);
    radialWash(ctx, f, cx, cy, unit * 0.8, [
      [0, `rgba(122,43,255,${0.18 + bass * 0.4})`],
      [1, 'rgba(122,43,255,0)'],
    ]);

    this._tunnel(ctx, f, cx, cy, unit);
    this._beams(ctx, f, cx, cy, unit);
    this._rings(ctx, f, cx, cy, unit);
    this._core(ctx, f, cx, cy, unit, bass);
    this._strobe(ctx, f);
  },

  /** Spawns a ring on the kick and moves the live ones outward. */
  _advanceRings(f) {
    this._ringList ??= [];
    for (const ring of this._ringList) ring.radius += f.dt * RING_SPEED;
    this._ringList = this._ringList.filter((ring) => ring.radius < RING_LIMIT);
    // 0.9 rather than any positive value: `beat` decays over 0.16s, so a lower
    // gate would spawn a ring on several frames of the same hit.
    if (f.beat > 0.9 && this._ringList.length < 8) this._ringList.push({ radius: 0.04 });
  },

  /**
   * Squares receding to the centre. Sizes step geometrically and the phase
   * slides with time, so a square reaching the edge is replaced by one
   * emerging from the middle and the tunnel never visibly loops.
   */
  _tunnel(ctx, f, cx, cy, unit) {
    const phase = (f.time * 0.35) % 1;
    ctx.save();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = Math.max(1, unit * 0.003);
    for (let i = 0; i < this.tunnel; i += 1) {
      const step = i + phase;
      const size = unit * 0.09 * 1.34 ** step;
      ctx.globalAlpha = Math.max(0, 0.32 - step * 0.03);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(step * 0.13 + f.time * 0.12);
      ctx.strokeRect(-size, -size, size * 2, size * 2);
      ctx.restore();
    }
    ctx.restore();
  },

  /** Laser fan: one beam per band slice, length from that slice. */
  _beams(ctx, f, cx, cy, unit) {
    const levels = resample(f.bands, this.beams);
    const spin = f.time * 0.42;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    for (let i = 0; i < this.beams; i += 1) {
      const angle = spin + (i / this.beams) * Math.PI * 2;
      const length = unit * (0.12 + levels[i] * 0.48);
      const x = cx + Math.cos(angle) * length;
      const y = cy + Math.sin(angle) * length;
      const beam = ctx.createLinearGradient(cx, cy, x, y);
      beam.addColorStop(0, 'rgba(182,255,0,0.9)');
      beam.addColorStop(0.6, 'rgba(122,43,255,0.5)');
      beam.addColorStop(1, 'rgba(122,43,255,0)');

      ctx.strokeStyle = beam;
      ctx.lineWidth = Math.max(1.2, unit * (0.004 + levels[i] * 0.008));
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.restore();
  },

  /** Shockwaves: thinner and fainter the further they have travelled. */
  _rings(ctx, f, cx, cy, unit) {
    if (!this._ringList?.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const ring of this._ringList) {
      const t = ring.radius / RING_LIMIT;
      ctx.strokeStyle = `rgba(182,255,0,${(1 - t) ** 1.6})`;
      ctx.lineWidth = Math.max(1, unit * 0.012 * (1 - t));
      ctx.beginPath();
      ctx.arc(cx, cy, ring.radius * unit * 0.72, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  },

  /** Hexagon core, inflating on the low end. */
  _core(ctx, f, cx, cy, unit, bass) {
    const radius = unit * (0.06 + bass * 0.055 + f.beat * 0.014);
    ctx.save();
    ctx.strokeStyle = '#b6ff00';
    ctx.lineWidth = Math.max(1.4, unit * 0.006);
    ctx.fillStyle = 'rgba(182,255,0,0.12)';
    withGlow(ctx, '#b6ff00', unit * 0.09, () => {
      polygonPath(ctx, cx, cy, radius, 6, f.time * 0.4);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  },

  /**
   * Full-frame flash, but only in the loud part of a track. Gating on level as
   * well as beat is what makes the difference between a verse and a drop
   * visible — otherwise every kick strobes and nothing builds.
   */
  _strobe(ctx, f) {
    const intensity = f.beat * Math.max(0, f.level - 0.38) * 0.9;
    if (intensity < 0.005) return;
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.3, intensity)})`;
    ctx.fillRect(0, 0, f.width, f.height);
  },
};
