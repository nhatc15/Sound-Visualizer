'use strict';

/** Deep violet ground colour taken from the reference artwork. */
export const BACKGROUND = '#1c0b30';

/**
 * Named colour stops shared by the presets. Each entry is an array of
 * [offset, cssColour] pairs, matching the neon ramps in the reference sheet.
 */
export const PALETTES = {
  sunrise: [[0, '#ff7a18'], [0.5, '#ffd21e'], [1, '#8fff2b']],
  ocean: [[0, '#2b6cff'], [0.5, '#22c9ff'], [1, '#4dffd0']],
  candy: [[0, '#ff2bd1'], [0.5, '#a34bff'], [1, '#2b6cff']],
  ember: [[0, '#ff2e2e'], [0.5, '#ff7a18'], [1, '#ffd21e']],
  mint: [[0, '#25ffa0'], [0.5, '#8fff2b'], [1, '#22ffe0']],
  violet: [[0, '#7a2bff'], [0.5, '#c93bff'], [1, '#ff2bd1']],
  aqua: [[0, '#22c9ff'], [1, '#7fe8ff']],
  duo: [[0, '#22ffe0'], [0.5, '#22c9ff'], [1, '#ff2bd1']],
  spectrum: [[0, '#ff2e2e'], [0.25, '#ff9c18'], [0.5, '#ffd21e'], [0.75, '#8fff2b'], [1, '#22ffe0']],
};

/**
 * Builds a linear gradient across the given axis.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<[number, string]>} palette
 * @param {number[]} axis [x0, y0, x1, y1]
 */
export function gradient(ctx, palette, [x0, y0, x1, y1]) {
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [offset, color] of palette) grad.addColorStop(offset, color);
  return grad;
}

/**
 * Samples a palette at `t` (0..1) and returns a css colour, interpolating in
 * RGB between the surrounding stops. Used where every bar needs its own
 * solid colour rather than a shared gradient object.
 */
export function samplePalette(palette, t) {
  const clamped = Math.max(0, Math.min(1, t));

  let lower = palette[0];
  let upper = palette[palette.length - 1];
  for (let i = 0; i < palette.length - 1; i += 1) {
    if (clamped >= palette[i][0] && clamped <= palette[i + 1][0]) {
      lower = palette[i];
      upper = palette[i + 1];
      break;
    }
  }

  const span = upper[0] - lower[0];
  const local = span === 0 ? 0 : (clamped - lower[0]) / span;
  const a = hexToRgb(lower[1]);
  const b = hexToRgb(upper[1]);

  const r = Math.round(a[0] + (b[0] - a[0]) * local);
  const g = Math.round(a[1] + (b[1] - a[1]) * local);
  const bl = Math.round(a[2] + (b[2] - a[2]) * local);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * Perceived-brightness test, used to pick readable overlay text on a preset
 * that brings its own background.
 * @param {string} hex
 */
export function isLightColor(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

/**
 * Draws `draw` once under a coloured shadow, which canvas paints behind the
 * crisp shape — that single pass already gives the neon halo. Drawing twice
 * would double-composite the fill and wash gradients out to flat yellow.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} color Glow colour.
 * @param {number} blur Shadow blur radius in px.
 * @param {() => void} draw
 */
export function withGlow(ctx, color, blur, draw) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  draw();
  ctx.restore();
}

/** Rounded rectangle path, tolerant of radii larger than half the box. */
export function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/**
 * Traces a Catmull-Rom-ish smooth curve through points using midpoint
 * quadratics — cheaper than real splines and visually identical at these
 * point densities.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x: number, y: number}>} points
 * @param {boolean} startNewSubpath False to join onto the current path, which
 *   a closed two-sided shape needs so both edges fill as one region.
 */
export function smoothPath(ctx, points, startNewSubpath = true) {
  if (points.length < 2) return;
  if (startNewSubpath) ctx.moveTo(points[0].x, points[0].y);
  else ctx.lineTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i += 1) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }

  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}

/**
 * Reads `count` evenly spaced values out of a band array, so a preset that
 * wants 32 bars and one that wants 96 can share the same analyser output.
 */
export function resample(source, count) {
  const out = new Array(count);
  const step = source.length / count;
  for (let i = 0; i < count; i += 1) {
    const start = Math.floor(i * step);
    const end = Math.max(start + 1, Math.floor((i + 1) * step));
    let max = 0;
    for (let s = start; s < end && s < source.length; s += 1) {
      if (source[s] > max) max = source[s];
    }
    out[i] = max;
  }
  return out;
}
