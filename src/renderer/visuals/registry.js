'use strict';

import { wavePresets } from './wave-presets.js';
import { barPresets } from './bar-presets.js';
import { dotPresets } from './dot-presets.js';
import { mirrorPresets } from './mirror-presets.js';
import { themePresets } from './themes/index.js';

/**
 * Reading order of the reference sheet (left to right, top to bottom), so the
 * arrow keys walk the presets in the same order the user saw them. The genre
 * themes follow, grouped together at the end: they are scenes rather than
 * spectrum plots, so mixing them into the sheet order would break the run of
 * matching styles the arrow keys walk through.
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
  'jazz-bluenote',
  'rock-stage',
  'pop-bubble',
  'citypop-drive',
  'country-road',
  'edm-drop',
  'lofi-tape',
  'hiphop-boombap',
];

const byId = new Map(
  [...wavePresets, ...barPresets, ...dotPresets, ...mirrorPresets, ...themePresets].map((p) => [
    p.id,
    p,
  ])
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
  { id: 'single', labelKey: 'layout.single', cols: 1, rows: 1 },
  { id: 'duo', labelKey: 'layout.duo', cols: 1, rows: 2 },
  { id: 'quad', labelKey: 'layout.quad', cols: 2, rows: 2 },
  { id: 'six', labelKey: 'layout.six', cols: 3, rows: 2 },
  { id: 'nine', labelKey: 'layout.nine', cols: 3, rows: 3 },
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
