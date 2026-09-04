'use strict';

import { AudioEngine } from './audio/audio-engine.js';
import { SpectrumAnalyzer } from './audio/spectrum-analyzer.js';
import { CanvasRenderer } from './visuals/canvas-renderer.js';
import {
  wrapIndex,
  layoutById,
  presetsForCells,
  defaultCellPresets,
} from './visuals/registry.js';
import { Controls } from './ui/controls.js';
import { ScreenManager, SCREEN } from './ui/screens.js';
import { SettingsPanel } from './ui/settings-panel.js';
import { normalizeSettings, DEFAULT_SETTINGS } from './ui/settings-schema.js';
import {
  applyTranslations,
  getLanguage,
  isLanguage,
  setLanguage,
  t,
} from './i18n/i18n.js';

/** How long the splash holds before handing over to the home screen. */
const SPLASH_SECONDS = 1.8;
/** Below this level for a while, tell the user nothing is playing. */
const SILENCE_LEVEL = 0.012;
const SILENCE_SECONDS = 1.5;
/** How long the cell-selection frame stays up after the last interaction. */
const SELECTION_SECONDS = 3;
/** Tail of that window spent fading, so it does not vanish on a single frame. */
const SELECTION_FADE_SECONDS = 0.5;
/** Device-change events arrive in bursts; coalesce them into one restart. */
const DEVICE_SETTLE_MS = 700;
/** Dead air this long is treated as a broken capture worth rebuilding. */
const DEAD_AIR_SECONDS = 8;
/** Minimum gap between silence-triggered rebuilds, so idle does not thrash. */
const RESTART_COOLDOWN_SECONDS = 30;

class VisualizerApp {
  constructor() {
    this.engine = new AudioEngine();
    this.analyzer = new SpectrumAnalyzer({ bandCount: 128, waveformPoints: 320 });
    this.renderer = new CanvasRenderer(document.getElementById('visualizer'));

    // One preset per grid cell; single view is simply cell 0, so there is no
    // separate code path for it.
    this.cellPresets = defaultCellPresets(0);
    this.selectedCell = 0;
    this.layout = layoutById('single');
    this.autoCycle = false;
    this.isOverlay = false;
    this.isFullscreen = false;
    /** Replaced by the stored settings during restoreState(). */
    this.settings = { ...DEFAULT_SETTINGS };
    this.startTime = performance.now() / 1000;
    this.lastFrameTime = this.startTime;
    this.autoTimer = 0;
    this.silenceTimer = 0;
    this.selectionTimer = SELECTION_SECONDS;
    this.frameHandle = null;
    this.deadAirTimer = 0;
    this.restartCooldown = 0;
    this.isRecovering = false;
    this.deviceTimer = null;
    this.splashTimer = null;
    this.screens = new ScreenManager((screen) => this._onScreenChange(screen));

    this.engine.onLost = () => this.recoverAudio();
    // Switching the Windows default output leaves the loopback capture bound
    // to the old endpoint: it stays "live" and simply never delivers another
    // sample, so nothing but a rebuild brings the visualiser back.
    navigator.mediaDevices.addEventListener('devicechange', () => {
      clearTimeout(this.deviceTimer);
      this.deviceTimer = setTimeout(() => this.recoverAudio(), DEVICE_SETTLE_MS);
    });

    this.controls = new Controls({
      onStart: () => this.start(),
      onSelectPreset: (index) => this.setPreset(index),
      onSelectCell: (cell) => this.selectCell(cell),
      onStepPreset: (delta) => this.setPreset(this.currentPreset + delta),
      onToggleFullscreen: () => this.toggleFullscreen(),
      onToggleOverlay: () => this.toggleOverlay(),
      onSelectLayout: (id) => this.setLayout(id),
      onToggleAuto: (enabled) => {
        this.autoCycle = enabled;
        this.autoTimer = 0;
        this._persistSetting('autoCycle', enabled);
      },
      onGoHome: () => this.screens.show(SCREEN.HOME),
      onStartVisualizing: () => this.screens.show(SCREEN.VISUALIZE),
      onOpenSettings: () => this.screens.openSettings(),
      onBack: () => this.screens.back(),
      onSelectLanguage: (id) => this.chooseLanguage(id),
      onSkipSplash: () => this.skipSplash(),
      onEscape: () => this.onEscape(),
    });

    this.settingsPanel = new SettingsPanel({
      onChange: (key, value) => this.applySetting(key, value),
      onReset: () => this.resetSettings(),
    });
  }

  /** Restores settings, mode and preset after the window was (re)built. */
  async restoreState() {
    const [state, stored] = await Promise.all([
      window.appBridge.getState(),
      window.appBridge.getSettings(),
    ]);

    this.settings = normalizeSettings(stored);
    // normalizeSettings fills in a default, so the raw blob is the only place
    // that still knows whether the user has ever answered the language picker.
    this.languageChosen = isLanguage(stored?.language);
    this._applyLanguage(this.settings.language);

    this.isOverlay = state.mode === 'overlay';
    this.renderer.setTransparent(this.isOverlay);
    this.controls.setOverlayActive(this.isOverlay);
    // A window rebuilt straight into fullscreen must drop its title bar too.
    this.isFullscreen = Boolean(state.fullscreen);
    this.controls.setFullscreenActive(this.isFullscreen);
    if (Array.isArray(state.cellPresets) && state.cellPresets.length) {
      this.cellPresets = state.cellPresets.slice();
    }
    this.selectedCell = state.selectedCell ?? 0;
    // Stored layout is the fallback; a mode switch carries the live one.
    this.setLayout(state.layout ?? this.settings.layout, { persist: false });
    this._applyRuntimeSettings();

    this.screens.show(this._initialScreen(state));

    // The main process answers getDisplayMedia itself, so capture needs no
    // user gesture and no permission prompt. Starting it here means the app is
    // live behind whatever screen is in front, which is what gives home and
    // settings a real visualisation as their backdrop. The Start panel remains
    // the retry path.
    await this.start();
  }

  /**
   * Overlay is a chrome-less widget with nowhere to put a menu, so it always
   * shows the visuals. A window rebuilt by a mode switch returns to the screen
   * it left. Otherwise the user's startup preferences decide.
   */
  _initialScreen(state) {
    if (this.isOverlay) return SCREEN.VISUALIZE;
    if (state.screen) return state.screen;
    // Ahead of the splash and of startInVisualizer: on a first run the choice
    // of language is the one thing that has to happen before anything else.
    if (!this.languageChosen) return SCREEN.LANGUAGE;
    if (this.settings.startInVisualizer) return SCREEN.VISUALIZE;
    return this.settings.showSplash ? SCREEN.SPLASH : SCREEN.HOME;
  }

  async start() {
    try {
      this.controls.showRunning();
      await this.engine.start();
      this.analyzer.buildBandMap(this.engine.binWidthHz, this.engine.frequencyData.length);
      this.lastFrameTime = performance.now() / 1000;
      this.loop();
    } catch (error) {
      this.controls.showError(describeError(error));
    }
  }

  /**
   * Rebuilds the capture after it dies. Capture needs no user gesture here
   * (the main process answers getDisplayMedia), so this is silent — the user
   * sees the visuals come back rather than an error panel to click through.
   */
  async recoverAudio() {
    if (this.isRecovering) return;
    this.isRecovering = true;
    this.deadAirTimer = 0;
    this.restartCooldown = RESTART_COOLDOWN_SECONDS;
    try {
      await this.engine.restart();
      // Sample rate can differ between output devices, so the log band map
      // has to be rebuilt against the new one rather than reused.
      this.analyzer.buildBandMap(this.engine.binWidthHz, this.engine.frequencyData.length);
      this.controls.showRunning();
    } catch (error) {
      this.controls.showError(describeError(error));
    } finally {
      this.isRecovering = false;
    }
  }

  /** Preset shown in the cell currently being edited. */
  get currentPreset() {
    return this.cellPresets[this.selectedCell];
  }

  setPreset(index) {
    this.cellPresets[this.selectedCell] = wrapIndex(index);
    this.autoTimer = 0;
    this.selectionTimer = SELECTION_SECONDS;
    this.controls.setPreset(this.currentPreset);
    this._rememberView();
  }

  /** Chooses which cell the preset controls act on. */
  selectCell(cell) {
    const cells = this.layout.cols * this.layout.rows;
    this.selectedCell = Math.max(0, Math.min(cells - 1, cell));
    this.selectionTimer = SELECTION_SECONDS;
    this.controls.setCell(this.selectedCell);
    this.controls.setPreset(this.currentPreset);
    this._rememberView();
  }

  /**
   * Grid shape; the preset index becomes the first cell of the grid.
   * @param {string} id
   * @param {{persist?: boolean}} options Pass persist:false when the value
   *   came from storage or from the settings form, which have already recorded
   *   it — writing it back would be a pointless round trip.
   */
  setLayout(id, { persist = true } = {}) {
    this.layout = layoutById(id);
    this.autoTimer = 0;
    const cells = this.layout.cols * this.layout.rows;
    this.controls.setLayout(this.layout.id, cells);
    // Editing a cell the new layout no longer shows would be invisible.
    this.selectCell(Math.min(this.selectedCell, cells - 1));
    if (persist) this._persistSetting('layout', this.layout.id);
  }

  _rememberView() {
    window.appBridge.rememberView({
      cellPresets: this.cellPresets,
      selectedCell: this.selectedCell,
      layout: this.layout.id,
      screen: this.screens.current,
    });
  }

  /** Keeps chrome, shortcut scope and the saved view in step with the screen. */
  _onScreenChange(screen) {
    this.controls.setScreen(screen);
    this.controls.revealChrome();
    clearTimeout(this.splashTimer);
    if (screen === SCREEN.SPLASH) this._scheduleSplashExit();
    // Arriving at the visualizer, show which cell the controls are editing.
    if (screen === SCREEN.VISUALIZE) this.selectionTimer = SELECTION_SECONDS;
    this._rememberView();
  }

  _scheduleSplashExit() {
    this.splashTimer = setTimeout(() => this.skipSplash(), SPLASH_SECONDS * 1000);
  }

  /** The splash hands over on its own; a click or any key cuts it short. */
  skipSplash() {
    if (this.screens.current !== SCREEN.SPLASH) return;
    this.screens.show(this.settings.startInVisualizer ? SCREEN.VISUALIZE : SCREEN.HOME);
  }

  /**
   * Esc walks back one screen, but fullscreen comes off first — dropping the
   * user out of fullscreen and into the menu on one keystroke loses their
   * place, and leaving fullscreen is almost always what they meant.
   */
  onEscape() {
    if (this.screens.current === SCREEN.SPLASH) {
      this.skipSplash();
      return;
    }
    if (this.isFullscreen) {
      this.toggleFullscreen();
      return;
    }
    this.screens.back();
  }

  /** Answer from the first-run picker: keep it, then get out of the way. */
  chooseLanguage(id) {
    this.languageChosen = true;
    this.applySetting('language', id);
    this.screens.show(this.settings.startInVisualizer ? SCREEN.VISUALIZE : SCREEN.HOME);
  }

  /**
   * Repaints the whole interface in `id`. Markup-driven text comes from the
   * data-i18n attributes; the two components that build their own DOM are told
   * to rebuild, and the form then gets its values back.
   */
  _applyLanguage(id) {
    setLanguage(id);
    applyTranslations();
    this.controls.retranslate();
    this.settingsPanel.retranslate();
    this.settingsPanel.setValues(this.settings);
  }

  /** An edit from the settings form: store it, then put it into effect. */
  applySetting(key, value) {
    this._persistSetting(key, value);
    this._applyRuntimeSettings();
  }

  resetSettings() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.settingsPanel.setValues(this.settings);
    window.appBridge.saveSettings(this.settings);
    this._applyRuntimeSettings();
  }

  /**
   * Records one setting and mirrors it into the form. Kept separate from
   * applySetting because changes that originate in the running view — the
   * footer's layout dropdown, the auto-cycle checkbox — are already in effect,
   * and re-applying them would fight the control the user is holding.
   */
  _persistSetting(key, value) {
    this.settings = { ...this.settings, [key]: value };
    this.settingsPanel.setValues(this.settings);
    window.appBridge.saveSettings(this.settings);
  }

  /** Pushes the current settings into the audio path and the view. */
  _applyRuntimeSettings() {
    const { sensitivity, smoothing, autoCycle, layout, language } = this.settings;

    if (getLanguage() !== language) this._applyLanguage(language);

    this.analyzer.sensitivity = sensitivity;
    this.engine.setSmoothing(smoothing);

    this.autoCycle = autoCycle;
    this.controls.setAuto(autoCycle);

    if (this.layout.id !== layout) this.setLayout(layout, { persist: false });
  }

  async toggleOverlay() {
    // The main process recreates the window; this instance goes away with it.
    await window.appBridge.toggleMode();
  }

  /**
   * A frameless transparent overlay cannot meaningfully go fullscreen, so from
   * overlay this leaves the mode and opens fullscreen in one step.
   */
  async toggleFullscreen() {
    if (this.isOverlay) {
      await window.appBridge.overlayToFullscreen();
      return;
    }
    this.isFullscreen = await window.appBridge.toggleFullscreen();
    this.controls.setFullscreenActive(this.isFullscreen);
  }

  loop() {
    this.frameHandle = requestAnimationFrame(() => this.loop());

    const now = performance.now() / 1000;
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;

    this.engine.poll();
    // The buffers are gone for the moment a rebuild takes; keep drawing the
    // last analysis rather than tearing the animation down and back up.
    if (this.engine.isRunning) {
      this.analyzer.update(this.engine.frequencyData, this.engine.timeDomainData, delta);
    }

    this.renderer.render(presetsForCells(this.cellPresets, this.layout), {
      bands: this.analyzer.bands,
      peaks: this.analyzer.peaks,
      waveform: this.analyzer.waveform,
      level: this.analyzer.level,
      levelSmooth: this.analyzer.levelSmooth,
      bass: this.analyzer.bass,
      mid: this.analyzer.mid,
      treble: this.analyzer.treble,
      beat: this.analyzer.beat,
      time: now - this.startTime,
      dt: delta,
    }, {
      ...this.layout,
      selectedCell: this.selectedCell,
      // The selection frame is an editing affordance. On home and settings the
      // canvas is only a backdrop, so it would just be a stray box.
      selectionOpacity: this.screens.isVisualizing ? this.selectionOpacity : 0,
    });

    this.selectionTimer = Math.max(0, this.selectionTimer - delta);
    this.updateAutoCycle(delta);
    this.updateSilenceHint(delta);
    this.updateWatchdog(delta);
  }

  /**
   * Last line of defence: a capture can die without the track reporting it and
   * without a device-change event — pausing playback long enough for Windows
   * to idle the endpoint is the case users hit. Dead air and a genuinely quiet
   * machine are indistinguishable from here, so rather than guess, this
   * rebuilds slowly and rate-limits itself. A needless rebuild while nothing
   * is playing costs nothing the user can see.
   */
  updateWatchdog(delta) {
    this.restartCooldown = Math.max(0, this.restartCooldown - delta);
    if (this.isRecovering || !this.engine.isRunning) return;

    if (!this.engine.isSilent) {
      this.deadAirTimer = 0;
      return;
    }
    this.deadAirTimer += delta;
    if (this.deadAirTimer < DEAD_AIR_SECONDS || this.restartCooldown > 0) return;
    this.recoverAudio();
  }

  /** 1 while the frame is fresh, easing to 0 over the last half second. */
  get selectionOpacity() {
    return Math.min(1, this.selectionTimer / SELECTION_FADE_SECONDS);
  }

  updateAutoCycle(delta) {
    if (!this.autoCycle) return;
    this.autoTimer += delta;
    if (this.autoTimer < this.settings.autoCycleSeconds) return;
    // Advance every cell, so a grid keeps showing distinct effects rather than
    // scrolling one cell past the others.
    this.cellPresets = this.cellPresets.map((index) => wrapIndex(index + 1));
    this.autoTimer = 0;
    this.controls.setPreset(this.currentPreset);
    this._rememberView();
  }

  updateSilenceHint(delta) {
    if (this.analyzer.level > SILENCE_LEVEL) {
      this.silenceTimer = 0;
      this.controls.setSilent(false);
      return;
    }
    this.silenceTimer += delta;
    // Only while the visualizer is what the user is looking at; on the home
    // screen the hint would sit over the menu complaining about silence nobody
    // asked it about.
    const overdue = this.silenceTimer > SILENCE_SECONDS;
    this.controls.setSilent(overdue && this.screens.isVisualizing);
  }
}

/** Maps the handful of failure modes onto messages the user can act on. */
function describeError(error) {
  if (error?.name === 'NotAllowedError') {
    return t('error.denied');
  }
  if (error?.message === 'NO_AUDIO_TRACK') {
    return t('error.noStream');
  }
  return t('error.generic', { message: error?.message ?? error });
}

const app = new VisualizerApp();
app.restoreState();
