'use strict';

import { vi } from './locales/vi.js';
import { en } from './locales/en.js';

/**
 * Selectable languages, in the order the picker and the settings dropdown show
 * them. Labels are autonyms on purpose: someone who opened the app in the wrong
 * language still has to recognise their own entry, so these are never
 * translated.
 */
export const LANGUAGES = [
  { id: 'vi', label: 'Tiếng Việt' },
  { id: 'en', label: 'English' },
];

const TABLES = { vi, en };

/** Falls back here for an unknown id and for keys a locale has not filled in. */
export const DEFAULT_LANGUAGE = 'vi';

let current = DEFAULT_LANGUAGE;

/** @param {string} id One of LANGUAGES; anything else lands on the default. */
export function setLanguage(id) {
  current = isLanguage(id) ? id : DEFAULT_LANGUAGE;
  document.documentElement.lang = current;
}

export function getLanguage() {
  return current;
}

/** @returns {boolean} Whether `id` names a language this build ships. */
export function isLanguage(id) {
  return typeof id === 'string' && Object.hasOwn(TABLES, id);
}

/**
 * Looks up a string in the active locale.
 *
 * @param {string} key Dot-namespaced key from the locale tables.
 * @param {Record<string, string | number>} [vars] Values for `{name}` slots.
 * @returns {string} The key itself when nothing matches, which makes a missing
 *   entry obvious on screen rather than rendering as a blank label.
 */
export function t(key, vars) {
  const text = TABLES[current][key] ?? TABLES[DEFAULT_LANGUAGE][key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : whole
  );
}

/**
 * The language to preselect before the user has chosen one. Electron reports
 * the OS UI language here, so a Windows install in English opens on English.
 */
export function detectLanguage() {
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of tags) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (isLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Rewrites every tagged node under `root`, so markup keeps owning the document
 * structure and only its text comes from the locale tables.
 *
 * `data-i18n` sets textContent; `data-i18n-html` sets innerHTML for the few
 * strings that wrap a <kbd> around a key name; `data-i18n-title` and
 * `data-i18n-aria` set the matching attributes.
 *
 * @param {ParentNode} [root]
 */
export function applyTranslations(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  // Locale tables are shipped with the app, never user input, so the markup in
  // them is ours and safe to insert as HTML.
  for (const el of root.querySelectorAll('[data-i18n-html]')) {
    el.innerHTML = t(el.dataset.i18nHtml);
  }
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle);
  }
  for (const el of root.querySelectorAll('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  }
}
