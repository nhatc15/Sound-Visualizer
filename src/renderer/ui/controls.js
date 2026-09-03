'use strict';

import { presets, LAYOUTS } from '../visuals/registry.js';

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
   */
  constructor(handlers) {
    this.handlers = handlers;
    this.dom = {
      error: document.getElementById('error'),
      errorMessage: document.getElementById('error-message'),
      silenceHint: document.getElementById('silence-hint'),
      select: document.getElementById('preset-select'),
      overlayName: document.getElementById('overlay-preset-name'),
      autoCheckbox: document.getElementById('chk-auto'),
      overlayButton: document.getElementById('btn-overlay'),
      layoutSelect: document.getElementById('layout-select'),
      cellSelect: document.getElementById('cell-select'),
      canvas: document.getElementById('visualizer'),
    };

    this._populatePresetOptions();
    this._populateLayoutOptions();
    this._bindButtons();
    this._bindKeyboard();
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
      switch (event.key) {
        case 'ArrowRight':
          this.handlers.onStepPreset(1);
          break;
        case 'ArrowLeft':
          this.handlers.onStepPreset(-1);
          break;
        case 'F11':
          event.preventDefault();
          this.handlers.onToggleFullscreen();
          break;
        case 'o':
        case 'O':
          if (event.ctrlKey) this.handlers.onToggleOverlay();
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

  /** Fullscreen hides the title bar; the preset controls stay reachable. */
  setFullscreenActive(active) {
    document.body.classList.toggle('fullscreen', active);
  }

  setOverlayActive(active) {
    document.body.classList.toggle('overlay', active);
    this.dom.overlayButton.classList.toggle('active', active);
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
