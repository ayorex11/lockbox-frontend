<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'

defineProps<{ title?: string; subtitle?: string; disabled?: boolean }>()
const emit = defineEmits<{ select: [file: File] }>()

const over = ref(false)
const input = ref<HTMLInputElement | null>(null)

function pick(files: FileList | null | undefined) {
  const file = files?.[0]
  if (file) emit('select', file)
}
function onDrop(event: DragEvent) {
  over.value = false
  pick(event.dataTransfer?.files)
}
function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  pick(target.files)
  target.value = '' // allow choosing the same file again
}
</script>

<template>
  <div
    role="button"
    tabindex="0"
    :aria-disabled="disabled"
    class="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors"
    :class="[
      over ? 'border-primary bg-primary-fixed/40' : 'border-outline-variant bg-surface-container-low hover:border-primary/60',
      disabled ? 'pointer-events-none opacity-60' : '',
    ]"
    @click="input?.click()"
    @keydown.enter.prevent="input?.click()"
    @keydown.space.prevent="input?.click()"
    @dragover.prevent="over = true"
    @dragleave.prevent="over = false"
    @drop.prevent="onDrop"
  >
    <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-lowest text-primary shadow-card">
      <Icon name="upload_file" :size="28" />
    </span>
    <div>
      <p class="text-base font-medium">{{ title ?? 'Drop a file here, or tap to choose' }}</p>
      <p class="hint mt-1">{{ subtitle ?? 'It gets locked in your browser before it is uploaded. Up to 25 MB.' }}</p>
    </div>
    <input ref="input" type="file" class="sr-only" tabindex="-1" @change="onChange" />
  </div>
</template>
