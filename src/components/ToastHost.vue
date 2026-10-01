<script setup lang="ts">
import { useToastStore } from '@/stores/toast'
import Icon from './Icon.vue'

const toasts = useToastStore()
const icons = { success: 'check_circle', error: 'error', info: 'info' } as const
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts.toasts"
        :key="toast.id"
        class="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-inverse-surface px-4 py-3 text-sm text-inverse-on-surface shadow-pop"
        role="status"
      >
        <Icon :name="icons[toast.kind]" fill :size="20" :class="toast.kind === 'error' ? 'text-error' : 'text-primary'" />
        <span class="flex-1">{{ toast.message }}</span>
        <button class="opacity-70 hover:opacity-100" aria-label="Dismiss" @click="toasts.dismiss(toast.id)">
          <Icon name="close" :size="18" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px); }
</style>
