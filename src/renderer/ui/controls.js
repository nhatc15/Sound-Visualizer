'use strict';

import { presets, LAYOUTS } from '../visuals/registry.js';
import { SCREEN } from './screens.js';

/** How long floating chrome stays up after the pointer stops moving. */
const CHROME_VISIBLE_SECONDS = 2.5;
/** Longer on entering overlay mode: this is the user's only cue it exists. */
const CHROME_INTRO_SECONDS = 5;

/**
 * Wires every button, the preset dropdown and the keyboard shortcuts to a set
 * of callbacks supplied by the app. Holds no state of its own beyond DOM
 * references, so the app stays the single source of truth.
 */
export class Controls {
  /**
   * @param {object} handlers
   * @param {(index: number) => void} handlers.onSelectPreset
   * @param {(delta: number) => void} handlers.onStepPreset
   * @param {() => void} handlers.onStart
   * @param {() => void} handlers.onToggleFullscreen
   * @param {() => void} handlers.onToggleOverlay
   * @param {(id: string) => void} handlers.onSelectLayout
   * @param {(cell: number) => void} handlers.onSelectCell
   * @param {(enabled: boolean) => void} handlers.onToggleAuto
   * @param {() => void} handlers.onGoHome
   * @param {() => void} handlers.onStartVisualizing
   * @param {() => void} handlers.onOpenSettings
   * @param {() => void} handlers.onBack
   * @param {() => void} handlers.onSkipSplash
   * @param {() => void} handlers.onEscape
   */
  constructor(handlers) {
    this.handlers = handlers;
    /** Which screen is in front; keyboard shortcuts are scoped to it. */
    this.screen = SCREEN.SPLASH;
    this.dom = {
      error: document.getElementById('error'),
      errorMessage: document.getElementById('error-message'),
      silenceHint: document.getElementById('silence-hint'),
      select: document.getElementById('preset-select'),
      overlayName: document.getElementById('overlay-preset-name'),
      autoCheckbox: document.getElementById('chk-auto'),
      overlayButton: document.getElementById('btn-overlay'),
      fullscreenButton: document.getElementById('btn-fullscreen'),
      layoutSelect: document.getElementById('layout-select'),
      cellSelect: document.getElementById('cell-select'),
      canvas: document.getElementById('visualizer'),
    };

    this.chromeTimer = null;

    this._populatePresetOptions();
    this._populateLayoutOptions();
    this._bindButtons();
    this._bindKeyboard();
    this._bindChromeReveal();
  }

  /**
   * Fullscreen and overlay both hide their chrome to stay out of the way; any
   * pointer movement brings it back for a few seconds.
   */
  _bindChromeReveal() {
    window.addEventListener('mousemove', () => this.revealChrome());
  }

  revealChrome(seconds = CHROME_VISIBLE_SECONDS) {
    document.body.classList.add('chrome-visible');
    clearTimeout(this.chromeTimer);
    this.chromeTimer = setTimeout(
      () => document.body.classList.remove('chrome-visible'),
      seconds * 1000
    );
  }

  _populatePresetOptions() {
    const fragment = document.createDocumentFragment();
    presets.forEach((preset, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${index + 1}. ${preset.name}`;
      fragment.appendChild(option);
    });
    this.dom.select.appendChild(fragment);
  }

  _populateLayoutOptions() {
    const fragment = document.createDocumentFragment();
    for (const layout of LAYOUTS) {
      const option = document.createElement('option');
      option.value = layout.id;
      option.textContent = layout.label;
      fragment.appendChild(option);
    }
    this.dom.layoutSelect.appendChild(fragment);
  }

  _bindButtons() {
    const click = (id, fn) => document.getElementById(id).addEventListener('click', fn);

    click('btn-retry', () => this.handlers.onStart());
    click('btn-minimize', () => window.appBridge.minimize());
    click('btn-close', () => window.appBridge.close());
    click('btn-prev', () => this.handlers.onStepPreset(-1));
    click('btn-next', () => this.handlers.onStepPreset(1));
    click('btn-fullscreen', () => this.handlers.onToggleFullscreen());
    click('btn-overlay', () => this.handlers.onToggleOverlay());

    click('btn-overlay-prev', () => this.handlers.onStepPreset(-1));
    click('btn-overlay-next', () => this.handlers.onStepPreset(1));
    click('btn-overlay-fullscreen', () => this.handlers.onToggleFullscreen());
    click('btn-overlay-exit', () => this.handlers.onToggleOverlay());
    click('btn-overlay-close', () => window.appBridge.close());

    click('btn-home', () => this.handlers.onGoHome());
    click('btn-settings', () => this.handlers.onOpenSettings());
    click('btn-home-start', () => this.handlers.onStartVisualizing());
    click('btn-home-settings', () => this.handlers.onOpenSettings());
    click('btn-home-quit', () => window.appBridge.close());
    click('btn-settings-back', () => this.handlers.onBack());
    click('splash', () => this.handlers.onSkipSplash());

    this.dom.select.addEventListener('change', (event) =>
      this.handlers.onSelectPreset(Number(event.target.value))
    );

    this.dom.layoutSelect.addEventListener('change', (event) =>
      this.handlers.onSelectLayout(event.target.value)
    );

    this.dom.cellSelect.addEventListener('change', (event) =>
      this.handlers.onSelectCell(Number(event.target.value))
    );

    // Clicking a cell is the obvious gesture; the dropdown is the discoverable
    // one. Both drive the same selection.
    this.dom.canvas.addEventListener('click', (event) => {
      if (this.cellCount <= 1) return;
      const rect = this.dom.canvas.getBoundingClientRect();
      const col = Math.floor(((event.clientX - rect.left) / rect.width) * this.gridCols);
      const row = Math.floor(((event.clientY - rect.top) / rect.height) * this.gridRows);
      this.handlers.onSelectCell(row * this.gridCols + col);
    });

    this.dom.autoCheckbox.addEventListener('change', (event) =>
      this.handlers.onToggleAuto(event.target.checked)
    );
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (event) => {
      // The splash is a greeting, not a gate: anything at all dismisses it.
      if (this.screen === SCREEN.SPLASH) {
        this.handlers.onSkipSplash();
        return;
      }

      // Available on every screen.
      switch (event.key) {
        case 'Escape':
          this.handlers.onEscape();
          return;
        case 'F11':
          event.preventDefault();
          this.handlers.onToggleFullscreen();
          return;
        case 'o':
        case 'O':
          if (event.ctrlKey) {
            this.handlers.onToggleOverlay();
            return;
          }
          break;
        default:
          break;
      }

      // Everything below edits what is on the canvas. On home or settings the
      // canvas is only a backdrop, so the same keys would silently rearrange
      // things the user is not looking at.
      if (this.screen !== SCREEN.VISUALIZE) return;

      switch (event.key) {
        case 'ArrowRight':
          this.handlers.onStepPreset(1);
          break;
        case 'ArrowLeft':
          this.handlers.onStepPreset(-1);
          break;
        case 'g':
        case 'G': {
          // Cycle grid shapes; handy in overlay mode, which has no dropdown.
          const current = LAYOUTS.findIndex((l) => l.id === this.dom.layoutSelect.value);
          const next = LAYOUTS[(current + 1) % LAYOUTS.length];
          this.handlers.onSelectLayout(next.id);
          break;
        }
        default:
          // Number keys 1-9 jump straight to the first nine presets.
          if (event.key >= '1' && event.key <= '9') {
            this.handlers.onSelectPreset(Number(event.key) - 1);
          }
      }
    });
  }

  /** @param {string} screen One of SCREEN; scopes the keyboard shortcuts. */
  setScreen(screen) {
    this.screen = screen;
  }

  /** Reflects the active preset in both the dropdown and the overlay label. */
  setPreset(index) {
    this.dom.select.value = String(index);
    this.dom.overlayName.textContent = presets[index].name;
  }

  /**
   * @param {string} id Layout id.
   * @param {number} cellCount Cells the layout shows; the cell picker is
   *   pointless with only one and stays hidden.
   */
  setLayout(id, cellCount) {
    const layout = LAYOUTS.find((entry) => entry.id === id) ?? LAYOUTS[0];
    this.dom.layoutSelect.value = id;
    this.cellCount = cellCount;
    this.gridCols = layout.cols;
    this.gridRows = layout.rows;

    this.dom.cellSelect.textContent = '';
    for (let i = 0; i < cellCount; i += 1) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = `Ô ${i + 1}`;
      this.dom.cellSelect.appendChild(option);
    }
    this.dom.cellSelect.classList.toggle('hidden', cellCount <= 1);
  }

  setCell(cell) {
    this.dom.cellSelect.value = String(cell);
  }

  setAuto(enabled) {
    this.dom.autoCheckbox.checked = enabled;
  }

  /**
   * Fullscreen hides the title bar and floats the control bar. The button
   * names the action it will perform, not the state it is in.
   */
  setFullscreenActive(active) {
    document.body.classList.toggle('fullscreen', active);
    this.dom.fullscreenButton.textContent = active ? 'Thoát toàn màn hình' : 'Toàn màn hình';
    this.dom.fullscreenButton.title = active
      ? 'Thoát toàn màn hình (F11)'
      : 'Toàn màn hình (F11)';
    if (active) this.revealChrome(CHROME_INTRO_SECONDS);
  }

  setOverlayActive(active) {
    document.body.classList.toggle('overlay', active);
    this.dom.overlayButton.classList.toggle('active', active);
    // Entering overlay, show the strip unprompted: it is otherwise invisible
    // until hovered, and a user who does not know it is there is stranded.
    if (active) this.revealChrome(CHROME_INTRO_SECONDS);
  }

  showRunning() {
    this.dom.error.classList.add('hidden');
  }

  showError(message) {
    this.dom.error.classList.remove('hidden');
    this.dom.errorMessage.textContent = message;
  }

  setSilent(isSilent) {
    this.dom.silenceHint.classList.toggle('hidden', !isSilent);
  }
}
