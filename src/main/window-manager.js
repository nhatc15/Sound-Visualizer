'use strict';

const path = require('path');
const { BrowserWindow, screen } = require('electron');

/** Chrome-less floating widget vs. a normal titled window. */
const MODE = { WINDOWED: 'windowed', OVERLAY: 'overlay' };

/**
 * Owns the single visualizer window and the windowed <-> overlay switch.
 * Switching modes recreates the window because frame/transparency are
 * construction-time only in Electron; the renderer restores its own state.
 */
class WindowManager {
  constructor({ isDev = false } = {}) {
    this.isDev = isDev;
    this.mode = MODE.WINDOWED;
    this.window = null;
    /**
     * The view the renderer last reported, restored after a mode switch
     * rebuilds the window: preset per grid cell, which cell is selected, and
     * the grid shape.
     */
    this.pendingView = { cellPresets: null, selectedCell: 0, layout: 'single' };
    /** Set when the next window should open straight into fullscreen. */
    this.pendingFullscreen = false;
  }

  /** @returns {Electron.BrowserWindow} */
  create() {
    const options =
      this.mode === MODE.OVERLAY ? this._overlayOptions() : this._windowedOptions();

    const created = new BrowserWindow({
      ...options,
      backgroundColor: this.mode === MODE.OVERLAY ? '#00000000' : '#1a0b2e',
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });
    this.window = created;

    created.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
    created.once('ready-to-show', () => {
      created.show();
      // Applied here rather than at construction: a window told to be
      // fullscreen before it is shown comes up the wrong size on Windows.
      if (this.pendingFullscreen) {
        created.setFullScreen(true);
        this.pendingFullscreen = false;
      }
    });
    created.on('closed', () => {
      // A mode switch destroys the old window *after* the new one exists, so
      // only clear the reference if this really is the window still in use.
      if (this.window === created) this.window = null;
    });

    if (this.mode === MODE.OVERLAY) {
      this.window.setAlwaysOnTop(true, 'screen-saver');
      this.window.setVisibleOnAllWorkspaces(true);
    }

    if (this.isDev) {
      this.window.webContents.openDevTools({ mode: 'detach' });
      // Surface renderer errors in the terminal; devtools alone hides them
      // from anyone driving the app from a shell.
      this.window.webContents.on('console-message', (event) => {
        console.log(`[renderer:${event.level}] ${event.message} (${event.sourceId}:${event.lineNumber})`);
      });
    }

    return this.window;
  }

  _windowedOptions() {
    return {
      width: 1100,
      height: 620,
      minWidth: 480,
      minHeight: 260,
      frame: false,
      transparent: false,
      title: 'Sound Visualizer',
    };
  }

  _overlayOptions() {
    // Anchor the widget to the bottom-centre of the work area.
    const { workArea } = screen.getPrimaryDisplay();
    const width = Math.min(900, Math.round(workArea.width * 0.6));
    const height = 260;

    return {
      width,
      height,
      minWidth: 320,
      minHeight: 140,
      x: workArea.x + Math.round((workArea.width - width) / 2),
      y: workArea.y + workArea.height - height - 60,
      frame: false,
      transparent: true,
      resizable: true,
      skipTaskbar: false,
      hasShadow: false,
    };
  }

  /**
   * Rebuilds the window in the opposite mode. The view to restore (preset and
   * layout) is whatever the renderer last reported, so it is not passed here.
   * @param {boolean} fullscreen Open the new window fullscreen. Only meaningful
   *   when leaving overlay, which is how "overlay -> fullscreen" is done in one
   *   step instead of forcing the user through windowed mode first.
   * @returns {string} The mode now active.
   */
  toggleMode(fullscreen = false) {
    this.pendingFullscreen = fullscreen;
    this.mode = this.mode === MODE.OVERLAY ? MODE.WINDOWED : MODE.OVERLAY;

    const previous = this.window;
    this.create();
    if (previous && !previous.isDestroyed()) previous.destroy();

    return this.mode;
  }

  /** Overlay-only: let clicks fall through to the desktop underneath. */
  setClickThrough(enabled) {
    if (!this.window || this.mode !== MODE.OVERLAY) return false;
    this.window.setIgnoreMouseEvents(enabled, { forward: true });
    return enabled;
  }
}

module.exports = { WindowManager, MODE };
