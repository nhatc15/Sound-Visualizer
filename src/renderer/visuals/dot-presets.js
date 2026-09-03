'use strict';

import { PALETTES, samplePalette, withGlow, resample } from './draw-utils.js';

/**
 * Mirrored columns of dots fading outward from the centre, the "amber pin
 * matrix" look. Reference sheet, row 1 column 3.
 */
const dottedMirror = {
  id: 'dotted-mirror',
  name: 'Dotted Mirror',
  columns: 84,
  dotsPerSide: 16,
  draw(ctx, f) {
    const values = resample(f.bands, this.columns);
    const mid = f.height / 2;
    const slot = f.width / this.columns;
    const spacing = (f.height * 0.46) / this.dotsPerSide;
    const radius = Math.max(1, Math.min(slot * 0.28, spacing * 0.36));

    withGlow(ctx, '#ff9c18', 9, () => {
      for (let c = 0; c < this.columns; c += 1) {
        const lit = Math.round(values[c] * this.dotsPerSide);
        const x = c * slot + slot / 2;

        for (let d = 0; d < lit; d += 1) {
          // Dots fade toward the tip so the column looks like it is dissolving.
          const fade = 1 - (d / this.dotsPerSide) * 0.55;
          ctx.fillStyle = samplePalette(PALETTES.ember, 1 - d / this.dotsPerSide);
          ctx.globalAlpha = fade;

          const offset = (d + 0.5) * spacing;
          ctx.beginPath();
          ctx.arc(x, mid - offset, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, mid + offset, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    });
  },
};

/**
 * Bottom-anchored dot matrix with a detached peak dot hovering above each
 * column. Reference sheet, row 4 column 1.
 */
const dotMatrix = {
  id: 'dot-matrix',
  name: 'Dot Matrix',
  columns: 76,
  rows: 22,
  draw(ctx, f) {
    const values = resample(f.bands, this.columns);
    const peaks = resample(f.peaks, this.columns);
    const slot = f.width / this.columns;
    const baseY = f.height * 0.92;
    const spacing = (f.height * 0.84) / this.rows;
    const radius = Math.max(1, Math.min(slot * 0.3, spacing * 0.34));

    for (let c = 0; c < this.columns; c += 1) {
      const x = c * slot + slot / 2;
      const lit = Math.round(values[c] * this.rows);

      for (let r = 0; r < lit; r += 1) {
        ctx.fillStyle = samplePalette(PALETTES.mint, r / this.rows);
        ctx.globalAlpha = 0.55 + 0.45 * (r / Math.max(1, lit));
        ctx.beginPath();
        ctx.arc(x, baseY - r * spacing, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Peak marker: a brighter, slightly larger dot left behind by transients.
      const peakRow = Math.round(peaks[c] * this.rows);
      if (peakRow > lit) {
        ctx.fillStyle = '#c9fff0';
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(x, baseY - peakRow * spacing, radius * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
  },
};

export const dotPresets = [dottedMirror, dotMatrix];
