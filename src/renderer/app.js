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

/** Seconds a preset stays on screen when auto-cycling. */
const AUTO_CYCLE_SECONDS = 20;
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
      },
    });
  }

  /** Restores mode + preset after the main process rebuilt the window. */
  async restoreState() {
    const state = await window.appBridge.getState();
    this.isOverlay = state.mode === 'overlay';
    this.renderer.setTransparent(this.isOverlay);
    this.controls.setOverlayActive(this.isOverlay);
    // A window rebuilt straight into fullscreen must drop its title bar too.
    this.controls.setFullscreenActive(Boolean(state.fullscreen));
    if (Array.isArray(state.cellPresets) && state.cellPresets.length) {
      this.cellPresets = state.cellPresets.slice();
    }
    this.selectedCell = state.selectedCell ?? 0;
    this.setLayout(state.layout ?? 'single');

    // The main process answers getDisplayMedia itself, so capture needs no
    // user gesture and no permission prompt — starting on load means the app
    // is simply live when it opens. The Start panel remains the retry path.
    await this.start();
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

  /** Grid shape; the preset index becomes the first cell of the grid. */
  setLayout(id) {
    this.layout = layoutById(id);
    this.autoTimer = 0;
    const cells = this.layout.cols * this.layout.rows;
    this.controls.setLayout(this.layout.id, cells);
    // Editing a cell the new layout no longer shows would be invisible.
    this.selectCell(Math.min(this.selectedCell, cells - 1));
  }

  _rememberView() {
    window.appBridge.rememberView({
      cellPresets: this.cellPresets,
      selectedCell: this.selectedCell,
      layout: this.layout.id,
    });
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
    const isFullscreen = await window.appBridge.toggleFullscreen();
    this.controls.setFullscreenActive(isFullscreen);
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
      time: now - this.startTime,
      dt: delta,
    }, {
      ...this.layout,
      selectedCell: this.selectedCell,
      selectionOpacity: this.selectionOpacity,
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
    if (this.autoTimer < AUTO_CYCLE_SECONDS) return;
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
    if (this.silenceTimer > SILENCE_SECONDS) this.controls.setSilent(true);
  }
}

/** Maps the handful of failure modes onto messages the user can act on. */
function describeError(error) {
  if (error?.name === 'NotAllowedError') {
    return 'Bạn đã từ chối quyền chia sẻ. Bấm "Thử lại" và chấp nhận để app đọc được âm thanh hệ thống.';
  }
  if (error?.message === 'NO_AUDIO_TRACK') {
    return 'Không nhận được luồng âm thanh hệ thống. Kiểm tra thiết bị phát mặc định trong Windows rồi thử lại.';
  }
  return `Lỗi khi khởi tạo âm thanh: ${error?.message ?? error}`;
}

const app = new VisualizerApp();
app.restoreState();
