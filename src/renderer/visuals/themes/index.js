'use strict';

import { jazzBlueNote } from './jazz-blue-note.js';
import { rockStage } from './rock-stage.js';
import { popBubble } from './pop-bubble.js';
import { cityPopDrive } from './citypop-drive.js';
import { countryRoad } from './country-road.js';
import { edmDrop } from './edm-drop.js';
import { lofiTape } from './lofi-tape.js';
import { hipHopBoomBap } from './hiphop-boombap.js';

/**
 * Genre themes. Unlike the reference-sheet presets, each of these builds a
 * scene with its own palette, ground and subject rather than plotting the
 * spectrum, so they live one to a file.
 */
export const themePresets = [
  jazzBlueNote,
  rockStage,
  popBubble,
  cityPopDrive,
  countryRoad,
  edmDrop,
  lofiTape,
  hipHopBoomBap,
];
