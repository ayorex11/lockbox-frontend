<script setup lang="ts" generic="T extends string">
import Icon from './Icon.vue'

const model = defineModel<T>({ required: true })
defineProps<{ options: { value: T; label: string; icon?: string }[]; label: string }>()
</script>

<template>
  <div role="radiogroup" :aria-label="label" class="flex gap-1 rounded-xl bg-surface-container p-1">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      class="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
      :class="model === option.value
        ? 'bg-surface-container-lowest text-on-surface shadow-sm'
        : 'text-on-surface-variant hover:text-on-surface'"
      @click="model = option.value"
    >
      <Icon v-if="option.icon" :name="option.icon" :size="18" :fill="model === option.value" />
      {{ option.label }}
    </button>
  </div>
</template>
