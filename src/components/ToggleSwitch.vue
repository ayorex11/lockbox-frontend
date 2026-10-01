<script setup lang="ts">
const model = defineModel<boolean>({ required: true })
defineProps<{ label: string; description?: string; icon?: string }>()
import Icon from './Icon.vue'
</script>

<template>
  <label class="flex cursor-pointer items-center gap-3 rounded-xl bg-surface-container-low p-4">
    <span v-if="icon" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
      <Icon :name="icon" :size="20" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block text-sm font-medium text-on-surface">{{ label }}</span>
      <span v-if="description" class="hint block">{{ description }}</span>
    </span>
    <input v-model="model" type="checkbox" role="switch" class="peer sr-only" />
    <span
      class="relative h-6 w-11 shrink-0 rounded-full bg-outline-variant transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
      aria-hidden="true"
    />
  </label>
</template>
