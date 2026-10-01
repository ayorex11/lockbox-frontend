<script setup lang="ts">
import Icon from './Icon.vue'

defineProps<{ label: string; value: string | number; hint?: string; icon: string }>()
</script>

<template>
  <div class="card p-5">
    <div class="flex items-start justify-between">
      <p class="text-sm font-medium text-on-surface-variant">{{ label }}</p>
      <span class="flex h-9 w-9 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed-variant">
        <Icon :name="icon" :size="18" />
      </span>
    </div>
    <p class="mt-2 text-3xl font-semibold tracking-tight">{{ value }}</p>
    <p v-if="hint" class="hint mt-1">{{ hint }}</p>
  </div>
</template>
