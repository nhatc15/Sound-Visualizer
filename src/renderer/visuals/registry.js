'use strict';

import { wavePresets } from './wave-presets.js';
import { barPresets } from './bar-presets.js';
import { dotPresets } from './dot-presets.js';
import { mirrorPresets } from './mirror-presets.js';

/**
 * Reading order of the reference sheet (left to right, top to bottom), so the
 * arrow keys walk the presets in the same order the user saw them.
 */
const ORDER = [
  'wave-line',
  'block-bars',
  'dotted-mirror',
  'multi-line',
  'thin-bars',
  'envelope-blob',
  'slider-eq',
  'outline-bars',
  'gradient-peaks',
  'dot-matrix',
  'sine-ribbon',
  'dual-mirror',
  'smooth-hills',
  'spiky-wave',
  'layered-spectrum',
  'spindle-wave',
];

const byId = new Map(
  [...wavePresets, ...barPresets, ...dotPresets, ...mirrorPresets].map((p) => [p.id, p])
);

/** @type {Array<{id: string, name: string, draw: Function}>} */
export const presets = ORDER.map((id) => {
  const preset = byId.get(id);
  if (!preset) throw new Error(`Preset "${id}" listed in ORDER but not exported`);
  return preset;
});

/** Wraps an index into range so next/prev cycle instead of clamping. */
export function wrapIndex(index) {
  return ((index % presets.length) + presets.length) % presets.length;
}

/**
 * Selectable grid shapes. The single cell is just the 1x1 case, so the render
 * path does not need a separate branch for "normal" viewing.
 */
export const LAYOUTS = [
  { id: 'single', label: '1 hiệu ứng', cols: 1, rows: 1 },
  { id: 'duo', label: '2 hiệu ứng', cols: 1, rows: 2 },
  { id: 'quad', label: '4 hiệu ứng', cols: 2, rows: 2 },
  { id: 'six', label: '6 hiệu ứng', cols: 3, rows: 2 },
  { id: 'nine', label: '9 hiệu ứng', cols: 3, rows: 3 },
];

export function layoutById(id) {
  return LAYOUTS.find((layout) => layout.id === id) ?? LAYOUTS[0];
}

/** Cells in the largest grid; every view is a slice of one array this long. */
export const MAX_CELLS = LAYOUTS.reduce(
  (most, layout) => Math.max(most, layout.cols * layout.rows),
  1
);

/**
 * Consecutive preset indices, so a freshly grown grid shows different effects
 * per cell instead of the same one repeated.
 */
export function defaultCellPresets(startIndex = 0) {
  return Array.from({ length: MAX_CELLS }, (_, i) => wrapIndex(startIndex + i));
}

/** Resolves the preset objects for the cells a layout actually shows. */
export function presetsForCells(cellPresets, layout) {
  const count = layout.cols * layout.rows;
  const out = new Array(count);
  for (let i = 0; i < count; i += 1) out[i] = presets[wrapIndex(cellPresets[i] ?? i)];
  return out;
}
