import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  THEME_STORAGE_KEY,
  readStoredPreference,
  resolveTheme,
  applyResolvedTheme
} from '../theme.js';

/** @typedef {import('../theme.js').ThemePreference} ThemePreference */

export function useTheme() {
  /** @type {import('vue').Ref<ThemePreference>} */
  const preference = ref(readStoredPreference());
  const resolved = computed(() => resolveTheme(preference.value));

  watch(
    preference,
    (p) => {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, p);
      } catch {
        /* ignore */
      }
      applyResolvedTheme(resolveTheme(p));
    },
    { immediate: true }
  );

  /** @type {MediaQueryList | null} */
  let mq = null;
  function onSystemChange() {
    if (preference.value === 'system') {
      applyResolvedTheme(resolveTheme('system'));
    }
  }

  onMounted(() => {
    mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', onSystemChange);
  });

  onUnmounted(() => {
    mq?.removeEventListener('change', onSystemChange);
  });

  /** @param {ThemePreference} p */
  function setPreference(p) {
    preference.value = p;
  }

  return { preference, resolved, setPreference };
}
