'use strict';

/**
 * English strings. Preset names (Neon Wave, Midnight Drive, ...) are proper
 * names and stay as they are in every locale, so they are not listed here.
 */
export const en = {
  'titlebar.minimize': 'Minimise',
  'titlebar.close': 'Close',

  'splash.tagline': 'Real-time effects driven by your system audio',

  'language.title': 'Language',
  'language.subtitle': 'Pick a display language. You can change it later in Settings.',

  'home.subtitle': '16 neon effects that follow whatever your PC is playing.',
  'home.start': 'Start',
  'home.settings': 'Settings',
  'home.quit': 'Quit',
  'home.hint': 'Watching the effects? Press <kbd>Esc</kbd> to come back here any time.',

  'settings.title': 'Settings',
  'settings.done': 'Done',
  'settings.back': 'Back (Esc)',
  'settings.reset': 'Reset to defaults',

  'error.title': 'Could not capture audio',
  'error.retry': 'Try again',
  'error.denied':
    'You declined the sharing prompt. Press "Try again" and accept so the app can read your system audio.',
  'error.noStream':
    'No system audio stream came back. Check your default playback device in Windows, then try again.',
  'error.generic': 'Audio could not start: {message}',
  'silence.hint': 'Nothing is playing right now',

  'controls.home': 'Home',
  'controls.homeTitle': 'Home (Esc)',
  'controls.prev': 'Previous effect',
  'controls.prevTitle': 'Previous effect (←)',
  'controls.next': 'Next effect',
  'controls.nextTitle': 'Next effect (→)',
  'controls.presetSelect': 'Choose an effect',
  'controls.layoutSelect': 'Effects shown at once',
  'controls.layoutSelectTitle': 'Effects shown at once (G)',
  'controls.cellSelect': 'Choose a cell to change',
  'controls.cellSelectTitle': 'Cell being edited — or click a cell on screen',
  'controls.cell': 'Cell {n}',
  'controls.auto': 'Auto-cycle',
  'controls.settings': 'Settings',
  'controls.overlay': 'Overlay',
  'controls.overlayTitle': 'Floating overlay mode (Ctrl+O)',
  'controls.fullscreen': 'Fullscreen',
  'controls.fullscreenTitle': 'Fullscreen (F11)',
  'controls.exitFullscreen': 'Exit fullscreen',
  'controls.exitFullscreenTitle': 'Exit fullscreen (F11)',

  'overlay.prev': 'Previous effect',
  'overlay.next': 'Next effect',
  'overlay.fullscreen': 'Fullscreen (F11)',
  'overlay.window': 'Window',
  'overlay.windowTitle': 'Back to the normal window (Ctrl+O or Alt+Shift+O)',
  'overlay.close': 'Close',

  'layout.single': '1 effect',
  'layout.duo': '2 effects',
  'layout.quad': '4 effects',
  'layout.six': '6 effects',
  'layout.nine': '9 effects',

  'settings.group.language': 'Language',
  'settings.group.display': 'Display',
  'settings.group.audio': 'Audio',
  'settings.group.startup': 'Startup',

  'settings.language.label': 'Display language',
  'settings.language.hint': 'Applies immediately; no restart needed.',
  'settings.layout.label': 'Grid layout',
  'settings.layout.hint': 'How many effects are drawn at once.',
  'settings.autoCycle.label': 'Cycle effects automatically',
  'settings.autoCycle.hint': 'Moves to the next effect after each interval.',
  'settings.autoCycleSeconds.label': 'Cycle interval',
  'settings.sensitivity.label': 'Sensitivity',
  'settings.sensitivity.hint': 'Raise it when quiet music leaves the effects flat.',
  'settings.smoothing.label': 'Smoothing',
  'settings.smoothing.hint': 'High is calm but slow to react; low is jumpy and sharp.',
  'settings.showSplash.label': 'Show the splash screen',
  'settings.startInVisualizer.label': 'Open straight into the effects',
  'settings.startInVisualizer.hint': 'Skips the home screen on launch.',
  'settings.unit.seconds': 's',
};
