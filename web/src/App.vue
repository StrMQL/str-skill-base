<template>
  <div id="app" class="min-h-screen flex flex-col bg-base-950 text-fg">
    <!-- Show navbar on all pages except landing, login, and setup -->
    <SkillBaseNav v-if="showNavbar" :current-path="currentPath" />
    <main class="flex-1 min-h-0">
      <router-view />
    </main>
    <footer
      v-if="showNavbar"
      class="shrink-0 border-t border-base-800/80 py-3"
    >
      <div class="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          class="flex flex-nowrap items-center justify-between gap-x-3 gap-y-0 overflow-x-auto text-[11px] font-mono text-base-400 whitespace-nowrap"
        >
          <p class="m-0 shrink-0">&copy; {{ copyrightYear }} Skill Base</p>
          <div class="flex flex-nowrap items-center gap-x-3 shrink-0">
            <a
              href="https://skillbase.reaidea.com"
              target="_blank"
              rel="noopener noreferrer"
              class="text-base-400 hover:text-fg transition-colors"
            >{{ t('footer.website') }}</a>
            <span class="text-base-700" aria-hidden="true">·</span>
            <a
              href="https://www.npmjs.com/package/skill-base-cli"
              target="_blank"
              rel="noopener noreferrer"
              class="text-base-400 hover:text-fg transition-colors"
            >{{ t('footer.cli') }}</a>
            <span class="text-base-700" aria-hidden="true">·</span>
            <a
              href="https://github.com/ginuim/skill-base/releases/tag/desktop-latest"
              target="_blank"
              rel="noopener noreferrer"
              class="text-base-400 hover:text-fg transition-colors"
            >{{ t('footer.desktop') }}</a>
            <span class="text-base-700" aria-hidden="true">·</span>
            <a
              href="https://github.com/ginuim/skill-base"
              target="_blank"
              rel="noopener noreferrer"
              class="text-base-400 hover:text-fg transition-colors"
            >GitHub</a>
          </div>
        </div>
      </div>
    </footer>
    <!-- Global Toast notification -->
    <Toast ref="toastRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import SkillBaseNav from '@/components/SkillBaseNav.vue'
import Toast from '@/components/Toast.vue'
import { useToast } from '@/composables/useToast'
import { useI18n } from '@/composables/useI18n'

const route = useRoute()
const toastRef = ref(null)
const { setToastRef } = useToast()
const { t } = useI18n()

onMounted(() => {
  if (toastRef.value) {
    setToastRef(toastRef.value as any)
  }
})

const showNavbar = computed(() => {
  // Don't show navbar on landing, login, and setup pages
  const noNavbarRoutes = ['landing', 'login', 'setup']
  return !noNavbarRoutes.includes(route.name as string)
})

const currentPath = computed(() => {
  return route.path
})

const copyrightYear = new Date().getFullYear()
</script>

<style>
/* Global styles are in main.css */
</style>
