'use strict';

import { LAYOUTS } from '../visuals/registry.js';

/**
 * Every user-facing setting declared once: the control that edits it, its
 * default, and for numeric ones the range that both the slider and the loader
 * clamp to. The settings form is generated from this list, so adding a setting
 * means adding one entry here and reading `settings[key]` where it applies —
 * there is no second place listing the same fields.
 */
export const SETTING_FIELDS = [
  {
    key: 'layout',
    group: 'Hiển thị',
    label: 'Bố cục lưới',
    hint: 'Số hiệu ứng vẽ cùng lúc.',
    type: 'select',
    options: LAYOUTS.map((layout) => ({ value: layout.id, label: layout.label })),
    default: 'single',
  },
  {
    key: 'autoCycle',
    group: 'Hiển thị',
    label: 'Tự đổi hiệu ứng',
    hint: 'Luân phiên sang hiệu ứng kế tiếp sau mỗi chu kỳ.',
    type: 'toggle',
    default: false,
  },
  {
    key: 'autoCycleSeconds',
    group: 'Hiển thị',
    label: 'Chu kỳ tự đổi',
    type: 'range',
    min: 5,
    max: 120,
    step: 5,
    unit: 'giây',
    default: 20,
    // Greyed out while auto-cycling is off: a live slider that changes nothing
    // reads as broken.
    enabledWhen: 'autoCycle',
  },
  {
    key: 'sensitivity',
    group: 'Âm thanh',
    label: 'Độ nhạy',
    hint: 'Tăng khi nhạc nhỏ mà hiệu ứng vẫn lẹt đẹt.',
    type: 'range',
    min: 0.5,
    max: 2.5,
    step: 0.1,
    unit: 'x',
    default: 1,
  },
  {
    key: 'smoothing',
    group: 'Âm thanh',
    label: 'Độ mượt',
    hint: 'Cao thì êm nhưng chậm phản ứng, thấp thì nảy và giật.',
    type: 'range',
    min: 0,
    max: 0.95,
    step: 0.05,
    default: 0.72,
  },
  {
    key: 'showSplash',
    group: 'Khởi động',
    label: 'Hiện màn hình chào',
    type: 'toggle',
    default: true,
  },
  {
    key: 'startInVisualizer',
    group: 'Khởi động',
    label: 'Mở thẳng vào hiệu ứng',
    hint: 'Bỏ qua trang chủ khi mở app.',
    type: 'toggle',
    default: false,
  },
];

/** Field groups in declaration order, for the settings form's section headings. */
export const SETTING_GROUPS = [...new Set(SETTING_FIELDS.map((f) => f.group))];

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

/** Formats a range value for the readout beside its slider. */
export function formatSetting(field, value) {
  const rounded = field.step < 1 ? value.toFixed(2) : String(value);
  return field.unit ? `${rounded} ${field.unit}` : rounded;
}
