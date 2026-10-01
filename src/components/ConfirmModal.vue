<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import BaseButton from './BaseButton.vue'
import Icon from './Icon.vue'

const props = defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  loading?: boolean
}>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()

const dialog = ref<HTMLElement | null>(null)

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && !props.loading) emit('cancel')
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      document.addEventListener('keydown', onKey)
      await nextTick()
      dialog.value?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    } else {
      document.removeEventListener('keydown', onKey)
    }
  },
)
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" @mousedown.self="!loading && emit('cancel')">
      <div ref="dialog" role="alertdialog" aria-modal="true" :aria-label="title" class="card w-full max-w-md p-6 shadow-pop">
        <div class="mb-4 flex h-11 w-11 items-center justify-center rounded-full" :class="danger ? 'bg-error-container text-on-error-container' : 'bg-primary-fixed text-on-primary-fixed-variant'">
          <Icon :name="danger ? 'warning' : 'help'" fill />
        </div>
        <h2 class="text-lg font-semibold">{{ title }}</h2>
        <p class="mt-1.5 text-[15px] text-on-surface-variant">{{ message }}</p>
        <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <BaseButton variant="secondary" :disabled="loading" @click="emit('cancel')">Cancel</BaseButton>
          <BaseButton :variant="danger ? 'danger' : 'primary'" :loading="loading" data-autofocus @click="emit('confirm')">
            {{ confirmLabel }}
          </BaseButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
