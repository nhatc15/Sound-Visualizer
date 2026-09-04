'use strict';

/** @enum {string} The things the window can be showing. */
export const SCREEN = {
  SPLASH: 'splash',
  LANGUAGE: 'language',
  HOME: 'home',
  SETTINGS: 'settings',
  VISUALIZE: 'visualize',
};

const VALUES = new Set(Object.values(SCREEN));

/**
 * Which screen is up, expressed as `data-screen` on <body> so the stylesheet
 * owns every show/hide decision and no JavaScript toggles classes per panel.
 *
 * Settings is the only screen reachable from two places (home and the running
 * visualizer), so it remembers where it was opened from and `back()` returns
 * there instead of guessing.
 */
export class ScreenManager {
  /** @param {(screen: string) => void} onChange Called after each transition. */
  constructor(onChange) {
    this.onChange = onChange;
    this.current = null;
    this._settingsOrigin = SCREEN.HOME;
  }

  /** @param {string} screen One of SCREEN. Unknown values fall back to home. */
  show(screen) {
    const next = VALUES.has(screen) ? screen : SCREEN.HOME;
    if (next === this.current) return;

    if (next === SCREEN.SETTINGS && this.current) {
      this._settingsOrigin = this.current;
    }

    this.current = next;
    document.body.dataset.screen = next;
    this.onChange(next);
  }

  /** Opens settings, recording the caller so `back()` can return to it. */
  openSettings() {
    this.show(SCREEN.SETTINGS);
  }

  /**
   * Leaves the current screen for the sensible place behind it: settings
   * returns to whoever opened it, the visualizer returns home, and home is
   * already the bottom of the stack.
   * @returns {boolean} False when there was nowhere to go.
   */
  back() {
    if (this.current === SCREEN.SETTINGS) {
      this.show(this._settingsOrigin);
      return true;
    }
    if (this.current === SCREEN.VISUALIZE || this.current === SCREEN.SPLASH) {
      this.show(SCREEN.HOME);
      return true;
    }
    return false;
  }

  get isVisualizing() {
    return this.current === SCREEN.VISUALIZE;
  }
}
