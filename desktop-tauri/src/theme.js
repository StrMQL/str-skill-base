/** Keep in sync with index.html inline script (avoid first-paint flash). */
export const THEME_STORAGE_KEY = 'skill-base-theme';

/** @typedef {'light' | 'dark' | 'system'} ThemePreference */

export function systemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** @param {ThemePreference} pref */
export function resolveTheme(pref) {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

/** @param {'light' | 'dark'} resolved */
export function applyResolvedTheme(resolved) {
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

/** @returns {ThemePreference} */
export function readStoredPreference() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}

export function initTheme() {
  applyResolvedTheme(resolveTheme(readStoredPreference()));
}
