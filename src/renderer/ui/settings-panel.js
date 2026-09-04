'use strict';

import {
  SETTING_FIELDS,
  SETTING_GROUPS,
  formatSetting,
  optionLabel,
} from './settings-schema.js';
import { t } from '../i18n/i18n.js';

/**
 * Builds the settings form from the schema and reports edits upward. Holds no
 * settings of its own — the app owns the values and pushes them back in via
 * `setValues`, so the form can never drift from what is actually applied.
 */
export class SettingsPanel {
  /**
   * @param {object} handlers
   * @param {(key: string, value: string | number | boolean) => void} handlers.onChange
   * @param {() => void} handlers.onReset
   */
  constructor(handlers) {
    this.handlers = handlers;
    this.body = document.getElementById('settings-body');
    /** @type {Map<string, {input: HTMLElement, readout: ?HTMLElement, row: HTMLElement}>} */
    this.controls = new Map();

    this._build();
    document
      .getElementById('btn-settings-reset')
      .addEventListener('click', () => this.handlers.onReset());
  }

  /** Rebuilds the form in the current language; the app re-applies values. */
  retranslate() {
    this.body.textContent = '';
    this.controls.clear();
    this._build();
  }

  _build() {
    for (const group of SETTING_GROUPS) {
      const section = document.createElement('section');
      section.className = 'settings-group';

      const heading = document.createElement('h3');
      heading.textContent = t(group);
      section.appendChild(heading);

      for (const field of SETTING_FIELDS.filter((f) => f.groupKey === group)) {
        section.appendChild(this._buildRow(field));
      }

      this.body.appendChild(section);
    }
  }

  _buildRow(field) {
    const row = document.createElement('div');
    row.className = 'settings-row';

    const text = document.createElement('div');
    text.className = 'settings-text';

    const label = document.createElement('label');
    label.textContent = t(field.labelKey);
    label.htmlFor = `set-${field.key}`;
    text.appendChild(label);

    if (field.hintKey) {
      const hint = document.createElement('p');
      hint.className = 'settings-hint';
      hint.textContent = t(field.hintKey);
      text.appendChild(hint);
    }
    row.appendChild(text);

    const control = document.createElement('div');
    control.className = 'settings-control';

    const input = this._buildInput(field);
    input.id = `set-${field.key}`;

    let readout = null;
    if (field.type === 'range') {
      readout = document.createElement('span');
      readout.className = 'settings-readout';
      control.appendChild(readout);
    }
    control.appendChild(input);
    row.appendChild(control);

    this.controls.set(field.key, { input, readout, row, field });
    return row;
  }

  _buildInput(field) {
    if (field.type === 'select') {
      const select = document.createElement('select');
      for (const option of field.options) {
        const el = document.createElement('option');
        el.value = option.value;
        el.textContent = optionLabel(option);
        select.appendChild(el);
      }
      select.addEventListener('change', (e) =>
        this.handlers.onChange(field.key, e.target.value)
      );
      return select;
    }

    if (field.type === 'toggle') {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.addEventListener('change', (e) =>
        this.handlers.onChange(field.key, e.target.checked)
      );
      return input;
    }

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = String(field.step);
    // `input`, not `change`: sliders that only report on release feel dead,
    // and every setting here is cheap enough to apply live.
    input.addEventListener('input', (e) =>
      this.handlers.onChange(field.key, Number(e.target.value))
    );
    return input;
  }

  /** Mirrors the app's settings into the form, including disabled states. */
  setValues(settings) {
    for (const [key, entry] of this.controls) {
      const { input, readout, row, field } = entry;
      const value = settings[key];

      if (field.type === 'toggle') input.checked = Boolean(value);
      else input.value = String(value);

      if (readout) readout.textContent = formatSetting(field, Number(value));

      if (field.enabledWhen) {
        const enabled = Boolean(settings[field.enabledWhen]);
        input.disabled = !enabled;
        row.classList.toggle('disabled', !enabled);
      }
    }
  }
}
