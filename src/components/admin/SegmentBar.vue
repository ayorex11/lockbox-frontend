<script setup lang="ts">
import { computed } from 'vue'
import { formatPercent } from '@/lib/format'

type Tone = 'primary' | 'tertiary' | 'secondary' | 'error' | 'muted'
const props = defineProps<{ segments: { label: string; value: number; tone: Tone }[]; label: string }>()

const toneClass: Record<Tone, string> = {
  primary: 'bg-primary',
  tertiary: 'bg-tertiary',
  secondary: 'bg-secondary',
  error: 'bg-error',
  muted: 'bg-outline-variant',
}
const total = computed(() => props.segments.reduce((a, s) => a + s.value, 0))
const parts = computed(() =>
  props.segments.map((s) => ({ ...s, cls: toneClass[s.tone], share: total.value ? s.value / total.value : 0 })),
)
</script>

<template>
  <div>
    <div class="flex h-3 overflow-hidden rounded-full bg-surface-container" role="img" :aria-label="label">
      <div
        v-for="p in parts"
        :key="p.label"
        v-show="p.value > 0"
        class="h-full first:rounded-l-full last:rounded-r-full"
        :class="p.cls"
        :style="{ width: `${p.share * 100}%` }"
      />
    </div>
    <ul class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
      <li v-for="p in parts" :key="p.label" class="flex items-center gap-2 text-on-surface-variant">
        <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="p.cls" />
        <span class="truncate">{{ p.label }}</span>
        <span class="ml-auto font-semibold tabular-nums text-on-surface">{{ p.value }}</span>
        <span class="w-9 text-right tabular-nums">{{ formatPercent(total ? p.share : null) }}</span>
      </li>
    </ul>
  </div>
</template>
