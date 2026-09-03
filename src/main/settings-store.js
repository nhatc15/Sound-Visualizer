'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Persists the renderer's settings blob to disk as JSON.
 *
 * Deliberately dumb: it stores and returns whatever object it is given and
 * knows nothing about individual settings. The renderer owns the schema and
 * validates on load (see ui/settings-schema.js), so there is one definition of
 * what a setting is rather than two that can drift apart.
 */
class SettingsStore {
  constructor(fileName = 'settings.json') {
    this.file = path.join(app.getPath('userData'), fileName);
  }

  /**
   * @returns {object} The stored settings, or an empty object when the file is
   *   missing, unreadable or corrupt — the renderer fills in defaults either
   *   way, so a bad file degrades to "first run" instead of a failed launch.
   */
  read() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  /**
   * Writes through a temp file and renames over the target, so a crash or a
   * power cut mid-write leaves the previous settings intact rather than a
   * truncated file that parses as nothing.
   * @param {object} settings
   * @returns {boolean} Whether the write landed.
   */
  write(settings) {
    if (!settings || typeof settings !== 'object') return false;

    const temp = `${this.file}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(temp, JSON.stringify(settings, null, 2), 'utf8');
      fs.renameSync(temp, this.file);
      return true;
    } catch (error) {
      console.error('[settings] write failed:', error.message);
      try {
        fs.unlinkSync(temp);
      } catch {
        // Nothing to clean up.
      }
      return false;
    }
  }
}

module.exports = { SettingsStore };
