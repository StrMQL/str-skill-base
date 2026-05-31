<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from '../i18n/index.js';

const props = defineProps({
  modelValue: { type: String, default: '' },
  versions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const open = ref(false);
const metaExpanded = ref(false);
const rootRef = ref(null);

const selected = computed(
  () => props.versions.find((v) => v.version === props.modelValue) || null
);

const triggerLabel = computed(() => {
  if (props.loading) return t('version.loading');
  if (!props.modelValue) return t('version.pick');
  const idx = props.versions.findIndex((v) => v.version === props.modelValue);
  const suffix = idx === 0 ? t('version.latest') : '';
  return `${props.modelValue}${suffix}`;
});

function uploaderLabel(version) {
  const u = version?.uploader;
  if (!u) return t('common.unknown');
  return u.name || u.username || t('common.unknown');
}

function optionLabel(v, index) {
  return `${v.version}${index === 0 ? t('version.latest') : ''}`;
}

function pick(version) {
  emit('update:modelValue', version);
  open.value = false;
}

function toggleOpen() {
  if (props.disabled || props.loading || !props.versions.length) return;
  open.value = !open.value;
}

function close() {
  open.value = false;
}

function onDocumentPointerDown(e) {
  if (!open.value) return;
  if (rootRef.value?.contains(e.target)) return;
  close();
}

onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown, true));
onUnmounted(() => document.removeEventListener('pointerdown', onDocumentPointerDown, true));
</script>

<template>
  <div ref="rootRef" class="version-select">
    <div class="version-select-control" :class="{ 'version-select-control--open': open }">
      <button
        type="button"
        class="version-select-trigger font-mono"
        :disabled="disabled || loading || !versions.length"
        :aria-expanded="open"
        @click="toggleOpen"
      >
        <span class="version-select-trigger-text">{{ triggerLabel }}</span>
        <i class="fa-solid fa-chevron-down version-select-chevron"></i>
      </button>

      <div v-show="open" class="version-select-panel" role="listbox">
        <button
          v-for="(v, i) in versions"
          :key="v.version"
          type="button"
          class="version-select-option font-mono"
          :class="{ 'version-select-option--active': v.version === modelValue }"
          role="option"
          :aria-selected="v.version === modelValue"
          @click="pick(v.version)"
        >
          <span>{{ optionLabel(v, i) }}</span>
          <i v-if="v.version === modelValue" class="fa-solid fa-check"></i>
        </button>
      </div>
    </div>

    <div v-if="selected && !loading" class="version-meta">
      <button
        type="button"
        class="version-meta-toggle"
        :aria-expanded="metaExpanded"
        @click="metaExpanded = !metaExpanded"
      >
        <span class="version-meta-toggle-summary">
          <template v-if="!metaExpanded">
            <span class="version-meta-toggle-label">{{ t('version.uploader') }}</span>
            <span class="version-meta-toggle-value font-mono">@{{ uploaderLabel(selected) }}</span>
            <span class="version-meta-toggle-hint">· {{ t('version.changelog') }}</span>
          </template>
          <span v-else class="version-meta-toggle-expanded">{{ t('version.details') }}</span>
        </span>
        <i
          class="fa-solid fa-chevron-down version-meta-toggle-chevron"
          :class="{ 'version-meta-toggle-chevron--open': metaExpanded }"
        ></i>
      </button>

      <div v-show="metaExpanded" class="version-meta-body">
        <p class="version-meta-row">
          <span class="version-meta-label">{{ t('version.uploader') }}</span>
          <span class="version-meta-value font-mono">@{{ uploaderLabel(selected) }}</span>
        </p>
        <p class="version-meta-label version-meta-changelog-heading">{{ t('version.changelog') }}</p>
        <p class="version-meta-changelog-text">
          {{ selected.changelog || t('version.noChangelog') }}
        </p>
      </div>

      <div v-if="$slots.actions" class="version-meta-actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.version-select-control {
  position: relative;
  z-index: 1;
}

.version-select-control--open {
  z-index: 70;
}

.version-select-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-base-800);
  background: rgba(var(--color-base-950-rgb), 0.6);
  color: var(--color-fg-strong);
  font-size: 0.875rem;
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    background 0.2s;
}

.version-select-trigger:hover:not(:disabled) {
  border-color: var(--accent-border-mid);
  background: var(--color-base-900);
}

.version-select-trigger:focus-visible {
  outline: none;
  box-shadow: var(--shadow-accent-ring);
  border-color: var(--color-accent);
}

.version-select-trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.version-select-trigger-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.version-select-chevron {
  font-size: 0.625rem;
  opacity: 0.75;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.version-select-control--open .version-select-chevron {
  transform: rotate(180deg);
}

.version-select-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 60;
  max-height: 12rem;
  overflow-y: auto;
  padding: 0.35rem;
  background: var(--color-base-950);
  border: 1px solid var(--color-base-800);
  border-radius: 0.625rem;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
}

.version-select-option {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: var(--color-fg-muted);
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.version-select-option:hover {
  background: var(--color-base-900);
  color: var(--color-fg-strong);
}

.version-select-option--active {
  background: var(--accent-bg-subtle);
  color: var(--color-accent-light);
}

.version-meta {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-base-800);
  background: rgba(var(--color-base-950-rgb), 0.5);
}

.version-meta-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 0.8125rem;
}

.version-meta-label {
  color: var(--color-base-400);
  flex-shrink: 0;
}

.version-meta-value {
  color: var(--color-fg-muted);
}

.version-meta-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-fg-muted);
  font-size: 0.8125rem;
  cursor: pointer;
  text-align: left;
  transition: color 0.15s;
}

.version-meta-toggle:hover {
  color: var(--color-accent-light);
}

.version-meta-toggle-summary {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.35rem;
}

.version-meta-toggle-label {
  color: var(--color-base-400);
  flex-shrink: 0;
}

.version-meta-toggle-value {
  color: var(--color-fg-muted);
}

.version-meta-toggle-hint,
.version-meta-toggle-expanded {
  color: var(--color-base-400);
}

.version-meta-toggle-chevron {
  font-size: 0.625rem;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.version-meta-toggle-chevron--open {
  transform: rotate(180deg);
}

.version-meta-body {
  margin-top: 0.625rem;
  padding-top: 0.625rem;
  border-top: 1px solid var(--color-base-800);
}

.version-meta-changelog-heading {
  margin: 0.75rem 0 0.35rem;
}

.version-meta-changelog-text {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--color-fg);
  white-space: pre-wrap;
  word-break: break-word;
}

.version-meta-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-base-800);
}

.version-meta-actions :deep(.version-detail-btn) {
  font-size: 0.8125rem;
  padding: 0.375rem 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--color-accent-light);
}

.version-meta-actions :deep(.version-detail-btn:hover) {
  color: var(--color-accent-lighter);
  border-color: var(--color-accent);
}
</style>
