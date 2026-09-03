'use strict';

import { BACKGROUND, isLightColor } from './draw-utils.js';

/**
 * Owns the canvas surface: device-pixel-ratio scaling, the per-frame clear and
 * dispatch into the active preset. Presets draw in CSS pixels and never touch
 * the DPR transform.
 */
export class CanvasRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} options
   * @param {boolean} options.transparent Skip the background fill (overlay mode).
   */
  constructor(canvas, { transparent = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.transparent = transparent;
    this.width = 0;
    this.height = 0;

    this._observer = new ResizeObserver(() => this.resize());
    this._observer.observe(canvas);
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const pixelWidth = Math.round(rect.width * dpr);
    const pixelHeight = Math.round(rect.height * dpr);

    // Assigning canvas.width clears the surface and resets the transform, so
    // only touch it when the size genuinely changed — an observer firing on an
    // unchanged layout would otherwise blank the frame already drawn.
    if (pixelWidth === this.canvas.width && pixelHeight === this.canvas.height) return;

    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * Draws one preset per grid cell. A 1x1 grid is the ordinary single view, so
   * there is only one path through here.
   *
   * @param {Array<{name: string, draw: Function}>} presets One per cell, in
   *   row-major order.
   * @param {object} frame Analyser output plus timing, passed straight through.
   * @param {{cols: number, rows: number, selectedCell: number,
   *   selectionOpacity: number}} grid
   */
  render(
    presets,
    frame,
    { cols = 1, rows = 1, selectedCell = 0, selectionOpacity = 1 } = {}
  ) {
    const { ctx } = this;

    ctx.clearRect(0, 0, this.width, this.height);
    if (!this.transparent) {
      ctx.fillStyle = BACKGROUND;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    const cellWidth = this.width / cols;
    const cellHeight = this.height / rows;
    const showLabels = cols * rows > 1;

    for (let i = 0; i < presets.length && i < cols * rows; i += 1) {
      const preset = presets[i];
      if (!preset) continue;

      const x = (i % cols) * cellWidth;
      const y = Math.floor(i / cols) * cellHeight;

      ctx.save();
      ctx.translate(x, y);
      // Clip per cell: glow and overshoot would otherwise bleed into the
      // neighbouring effect and the grid would read as one smeared image.
      ctx.beginPath();
      ctx.rect(0, 0, cellWidth, cellHeight);
      ctx.clip();

      // A preset may bring its own ground colour; painted per cell so one
      // inverted effect does not repaint the whole grid.
      if (preset.background) {
        ctx.fillStyle = preset.background;
        ctx.fillRect(0, 0, cellWidth, cellHeight);
      }

      // Plain source-over: additive blending saturated large gradient fills
      // into flat yellow. The neon look comes from shadow glow, not blending.
      preset.draw(ctx, { ...frame, width: cellWidth, height: cellHeight });

      if (showLabels) {
        const onLight = preset.background ? isLightColor(preset.background) : false;
        this._drawLabel(preset.name, cellHeight, onLight);
      }
      ctx.restore();
    }

    if (showLabels) {
      this._drawGridLines(cols, rows, cellWidth, cellHeight);
      this._drawSelection(selectedCell, cols, cellWidth, cellHeight, selectionOpacity);
    }
  }

  /**
   * Marks the cell the preset controls are editing. Fades out once the user
   * stops interacting, so the frame does not sit permanently over the visuals.
   */
  _drawSelection(index, cols, cellWidth, cellHeight, opacity) {
    if (opacity <= 0) return;
    const { ctx } = this;
    const x = (index % cols) * cellWidth;
    const y = Math.floor(index / cols) * cellHeight;

    ctx.save();
    ctx.strokeStyle = `rgba(201, 59, 255, ${0.85 * opacity})`;
    ctx.lineWidth = 2;
    // Inset by half the stroke so the frame is not clipped at the canvas edge.
    ctx.strokeRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);
    ctx.restore();
  }

  /** Cell caption, dim enough to stay out of the way of the visuals. */
  _drawLabel(name, cellHeight, onLight) {
    const { ctx } = this;
    const size = Math.max(9, Math.min(13, cellHeight * 0.055));

    ctx.font = `${size}px 'Segoe UI', system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = onLight ? 'rgba(20, 18, 26, 0.5)' : 'rgba(233, 220, 255, 0.45)';
    ctx.fillText(name, size * 0.7, size * 0.6);
  }

  _drawGridLines(cols, rows, cellWidth, cellHeight) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(160, 140, 196, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < cols; c += 1) {
      ctx.moveTo(c * cellWidth, 0);
      ctx.lineTo(c * cellWidth, this.height);
    }
    for (let r = 1; r < rows; r += 1) {
      ctx.moveTo(0, r * cellHeight);
      ctx.lineTo(this.width, r * cellHeight);
    }
    ctx.stroke();
    ctx.restore();
  }

  setTransparent(value) {
    this.transparent = value;
  }

  destroy() {
    this._observer.disconnect();
  }
}
