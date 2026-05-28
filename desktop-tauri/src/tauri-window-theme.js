import { getCurrentWindow } from '@tauri-apps/api/window';
import { readStoredPreference } from './theme.js';

async function syncNativeWindowTheme() {
  const preference = readStoredPreference();
  await getCurrentWindow().setTheme(preference === 'system' ? null : preference);
}

/** Sync macOS/Windows title bar with app theme preference. */
export function initTauriWindowTheme() {
  syncNativeWindowTheme().catch(() => {});

  const observer = new MutationObserver(() => {
    syncNativeWindowTheme().catch(() => {});
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (readStoredPreference() === 'system') {
      syncNativeWindowTheme().catch(() => {});
    }
  });
}
