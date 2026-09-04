'use strict';

import { LAYOUTS } from '../visuals/registry.js';
import { LANGUAGES, DEFAULT_LANGUAGE, t } from '../i18n/i18n.js';

/**
 * Every user-facing setting declared once: the control that edits it, its
 * default, and for numeric ones the range that both the slider and the loader
 * clamp to. The settings form is generated from this list, so adding a setting
 * means adding one entry here and reading `settings[key]` where it applies —
 * there is no second place listing the same fields.
 *
 * Text is stored as locale keys rather than finished strings: the form is
 * rebuilt on a language change, and a field holding a string would still be
 * showing the language the app started in.
 */
export const SETTING_FIELDS = [
  {
    key: 'language',
    groupKey: 'settings.group.language',
    labelKey: 'settings.language.label',
    hintKey: 'settings.language.hint',
    type: 'select',
    // Autonyms, so they read correctly whichever language is active.
    options: LANGUAGES.map((language) => ({ value: language.id, label: language.label })),
    default: DEFAULT_LANGUAGE,
  },
  {
    key: 'layout',
    groupKey: 'settings.group.display',
    labelKey: 'settings.layout.label',
    hintKey: 'settings.layout.hint',
    type: 'select',
    options: LAYOUTS.map((layout) => ({ value: layout.id, labelKey: layout.labelKey })),
    default: 'single',
  },
  {
    key: 'autoCycle',
    groupKey: 'settings.group.display',
    labelKey: 'settings.autoCycle.label',
    hintKey: 'settings.autoCycle.hint',
    type: 'toggle',
    default: false,
  },
  {
    key: 'autoCycleSeconds',
    groupKey: 'settings.group.display',
    labelKey: 'settings.autoCycleSeconds.label',
    type: 'range',
    min: 5,
    max: 120,
    step: 5,
    unitKey: 'settings.unit.seconds',
    default: 20,
    // Greyed out while auto-cycling is off: a live slider that changes nothing
    // reads as broken.
    enabledWhen: 'autoCycle',
  },
  {
    key: 'sensitivity',
    groupKey: 'settings.group.audio',
    labelKey: 'settings.sensitivity.label',
    hintKey: 'settings.sensitivity.hint',
    type: 'range',
    min: 0.5,
    max: 2.5,
    step: 0.1,
    unit: 'x',
    default: 1,
  },
  {
    key: 'smoothing',
    groupKey: 'settings.group.audio',
    labelKey: 'settings.smoothing.label',
    hintKey: 'settings.smoothing.hint',
    type: 'range',
    min: 0,
    max: 0.95,
    step: 0.05,
    default: 0.72,
  },
  {
    key: 'showSplash',
    groupKey: 'settings.group.startup',
    labelKey: 'settings.showSplash.label',
    type: 'toggle',
    default: true,
  },
  {
    key: 'startInVisualizer',
    groupKey: 'settings.group.startup',
    labelKey: 'settings.startInVisualizer.label',
    hintKey: 'settings.startInVisualizer.hint',
    type: 'toggle',
    default: false,
  },
];

/** Field groups in declaration order, for the settings form's section headings. */
export const SETTING_GROUPS = [...new Set(SETTING_FIELDS.map((f) => f.groupKey))];

export const DEFAULT_SETTINGS = Object.fromEntries(
  SETTING_FIELDS.map((field) => [field.key, field.default])
);

/**
 * Coerces a stored settings blob into something every consumer can trust.
 * The file on disk is user-editable and may have been written by an older
 * build, so anything unrecognised, out of range or of the wrong type falls
 * back to the default rather than reaching the audio path.
 *
 * @param {unknown} raw Parsed contents of the settings file.
 * @returns {Record<string, string | number | boolean>}
 */
export function normalizeSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const out = {};

  for (const field of SETTING_FIELDS) {
    const value = source[field.key];

    if (field.type === 'toggle') {
      out[field.key] = typeof value === 'boolean' ? value : field.default;
    } else if (field.type === 'range') {
      out[field.key] = Number.isFinite(value)
        ? Math.min(field.max, Math.max(field.min, value))
        : field.default;
    } else {
      const allowed = field.options.some((option) => option.value === value);
      out[field.key] = allowed ? value : field.default;
    }
  }

  return out;
}

/** The label to show for one option of a select field. */
export function optionLabel(option) {
  return option.labelKey ? t(option.labelKey) : option.label;
}

/** Formats a range value for the readout beside its slider. */
export function formatSetting(field, value) {
  const rounded = field.step < 1 ? value.toFixed(2) : String(value);
  const unit = field.unitKey ? t(field.unitKey) : field.unit;
  return unit ? `${rounded} ${unit}` : rounded;
}
