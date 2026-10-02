<script setup lang="ts">
import { computed } from 'vue'
import { formatCompact, formatPercent } from '@/lib/format'

const props = defineProps<{ steps: { label: string; value: number }[] }>()

const shades = ['bg-primary', 'bg-primary/75', 'bg-primary/50']
const rows = computed(() => {
  const top = Math.max(1, props.steps[0]?.value ?? 0)
  return props.steps.map((step, i) => {
    const prev = i === 0 ? null : props.steps[i - 1]!.value
    return {
      ...step,
      width: step.value > 0 ? Math.max(2, Math.round((step.value / top) * 100)) : 0,
      // Share of the previous step that made it here (the drop-off to look at).
      conversion: prev === null ? null : prev > 0 ? step.value / prev : null,
      shade: shades[Math.min(i, shades.length - 1)],
    }
  })
})
</script>

<template>
  <ol class="space-y-4">
    <li v-for="row in rows" :key="row.label">
      <div class="flex items-baseline justify-between gap-3 text-sm">
        <span class="font-medium">{{ row.label }}</span>
        <span class="tabular-nums text-on-surface-variant">
          <span class="font-semibold text-on-surface">{{ formatCompact(row.value) }}</span>
          <template v-if="row.conversion !== null"> · {{ formatPercent(row.conversion) }} of previous</template>
        </span>
      </div>
      <div class="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-container" role="presentation">
        <div class="h-full rounded-full transition-all" :class="row.shade" :style="{ width: `${row.width}%` }" />
      </div>
    </li>
  </ol>
</template>
