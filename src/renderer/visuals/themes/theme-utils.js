'use strict';

import { hashNoise } from '../draw-utils.js';

/**
 * Helpers shared by the genre themes. Each theme brings its own palette and
 * subject; what they share is the room they are staged in — a wash, a pool of
 * light, a field of specks, an edge falloff.
 */

/** Fills the whole cell with a vertical gradient. */
export function verticalWash(ctx, f, stops) {
  const grad = ctx.createLinearGradient(0, 0, 0, f.height);
  for (const [offset, color] of stops) grad.addColorStop(offset, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, f.width, f.height);
}

/**
 * Pool of light over the whole cell. The outer stop should be transparent, so
 * what lands is a glow rather than a disc with a visible rim.
 */
export function radialWash(ctx, f, cx, cy, radius, stops) {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  for (const [offset, color] of stops) grad.addColorStop(offset, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, f.width, f.height);
}

/**
 * Field of drifting specks: dust, stars, grain, rain. Positions come from the
 * hash rather than stored particles, so the field costs nothing to keep and
 * looks identical in every grid cell it is drawn into.
 *
 * @param {object} options
 * @param {number} options.count Specks drawn.
 * @param {string} options.color CSS colour, alpha applied separately.
 * @param {number} options.alpha Peak alpha; each speck varies below it.
 * @param {number} options.radius Peak radius in px.
 * @param {number} [options.driftY] Screens per second, downward. Negative rises.
 * @param {number} [options.driftX] Screens per second, rightward.
 * @param {number} [options.seed] Changes the layout without changing the look.
 */
export function speckField(ctx, f, { count, color, alpha, radius, driftY = 0, driftX = 0, seed = 1 }) {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i += 1) {
    const size = radius * (0.35 + hashNoise(i, seed + 3) * 0.65);
    ctx.globalAlpha = alpha * (0.3 + hashNoise(i, seed + 4) * 0.7);
    ctx.beginPath();
    ctx.arc(
      wrap01(hashNoise(i, seed) + f.time * driftX) * f.width,
      wrap01(hashNoise(i, seed + 1) + f.time * driftY) * f.height,
      size,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();
}

/** Darkens the edges so the middle reads as the lit subject. */
export function vignette(ctx, f, strength = 0.55) {
  const radius = Math.max(f.width, f.height) * 0.75;
  radialWash(ctx, f, f.width / 2, f.height / 2, radius, [
    [0.45, 'rgba(0,0,0,0)'],
    [1, `rgba(0,0,0,${strength})`],
  ]);
}

/** Horizontal CRT lines. Spacing is in px and stays constant as cells shrink. */
export function scanlines(ctx, f, spacing = 3, alpha = 0.16) {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  for (let y = 0; y < f.height; y += spacing * 2) ctx.fillRect(0, y, f.width, spacing);
  ctx.restore();
}

/**
 * True only for the first cell drawn in a frame.
 *
 * Presets are singletons, so a 3x3 grid calls the same object nine times per
 * frame. Any preset carrying simulation state — shockwave rings, a damped
 * needle, a scrolling floor — must advance it here, or the simulation runs
 * nine times as fast in a grid as it does alone.
 */
export function firstCellOfFrame(preset, f) {
  if (preset._stateTime === f.time) return false;
  preset._stateTime = f.time;
  return true;
}

/** Keeps a drifting 0..1 coordinate inside range without a branch per speck. */
function wrap01(value) {
  return value - Math.floor(value);
}

/** Regular polygon path, for the hexagon cores and diamond confetti. */
export function polygonPath(ctx, cx, cy, radius, sides, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const angle = rotation + (i / sides) * Math.PI * 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * Average of a slice of the band array, as a fraction of the spectrum.
 * Themes reach for named registers ("the low third") far more than for
 * individual bands.
 */
export function bandRange(bands, from, to) {
  const start = Math.floor(bands.length * from);
  const end = Math.max(start + 1, Math.floor(bands.length * to));
  let sum = 0;
  for (let i = start; i < end; i += 1) sum += bands[i];
  return sum / (end - start);
}
