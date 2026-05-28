import { createApp } from 'vue';
import App from './App.vue';
import './style.css';
import { installI18n } from './i18n/index.js';
import { initTheme } from './theme.js';
import { installSkb } from './skb.js';
import { initTauriWindowTheme } from './tauri-window-theme.js';
import appLogoSrc from '../src-tauri/icons/128x128.png';

initTheme();
initTauriWindowTheme();
installSkb();

const app = createApp(App);
app.provide('appLogoSrc', appLogoSrc);
installI18n(app);
app.mount('#app');
