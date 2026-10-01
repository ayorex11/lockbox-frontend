<script setup lang="ts">
defineProps<{ value?: number | null; label?: string }>()
</script>

<template>
  <div
    class="h-2 w-full overflow-hidden rounded-full bg-surface-container-high"
    role="progressbar"
    :aria-label="label"
    :aria-valuenow="value == null ? undefined : Math.round(value * 100)"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div
      v-if="value != null"
      class="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
      :style="{ width: `${Math.max(2, Math.min(1, value) * 100)}%` }"
    />
    <div v-else class="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
  </div>
</template>

<style scoped>
@keyframes slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}
</style>
