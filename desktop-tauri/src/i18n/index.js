import { ref, computed } from 'vue';
import zh from './messages/zh.js';
import en from './messages/en.js';

const STORAGE_KEY = 'skill-base-desktop-locale';
const catalogs = { zh, en };

function resolve(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function interpolate(text, params) {
  if (!params) return text;
  return String(text).replace(/\{(\w+)\}/g, (_, key) =>
    params[key] != null ? String(params[key]) : `{${key}}`
  );
}

function detectDefaultLocale() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'zh' || saved === 'en') return saved;
  const lang = (navigator.language || 'en').toLowerCase();
  return lang.startsWith('zh') ? 'zh' : 'en';
}

export const locale = ref(detectDefaultLocale());

export function setLocale(next) {
  if (next !== 'zh' && next !== 'en') return;
  locale.value = next;
  localStorage.setItem(STORAGE_KEY, next);
  document.documentElement.lang = next;
}

export function useI18n() {
  const t = (key, params) => {
    const catalog = catalogs[locale.value] || catalogs.en;
    const raw = resolve(catalog, key) ?? resolve(catalogs.en, key) ?? key;
    return interpolate(raw, params);
  };

  const localeLabel = computed(() => (locale.value === 'zh' ? '中文' : 'English'));

  return { locale, setLocale, t, localeLabel };
}

export function installI18n(app) {
  document.documentElement.lang = locale.value;
  app.provide('i18n', useI18n());
}
