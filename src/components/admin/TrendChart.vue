<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { linePath, nearestIndex, niceMax, sum, xAt, yAt, type TrendSeries } from '@/lib/chart'
import { formatCompact, formatShortDate } from '@/lib/format'

const props = defineProps<{ dates: string[]; series: TrendSeries[]; label: string }>()

const HEIGHT = 220
const PAD = { left: 40, right: 12, top: 12, bottom: 28 }

// Track the container width so text stays a readable size on phones (no viewBox scaling).
const box = ref<HTMLElement | null>(null)
const width = ref(640)
let observer: ResizeObserver | undefined
onMounted(() => {
  if (!box.value) return
  width.value = Math.max(280, Math.round(box.value.clientWidth) || 640)
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      if (box.value) width.value = Math.max(280, Math.round(box.value.clientWidth) || width.value)
    })
    observer.observe(box.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())

const plot = computed(() => ({
  left: PAD.left,
  top: PAD.top,
  width: width.value - PAD.left - PAD.right,
  height: HEIGHT - PAD.top - PAD.bottom,
}))
const count = computed(() => props.dates.length)
const max = computed(() => niceMax(Math.max(0, ...props.series.flatMap((s) => s.values))))
const ticks = computed(() =>
  [0, 1, 2, 3, 4].map((i) => {
    const value = (max.value / 4) * i
    return { value, y: yAt(value, max.value, plot.value.top, plot.value.height) }
  }),
)
const paths = computed(() =>
  props.series.map((s) => ({ ...s, d: linePath(s.values, max.value, plot.value), total: sum(s.values) })),
)
const xLabels = computed(() => {
  const n = count.value
  if (n === 0) return []
  const picks = n === 1 ? [0] : n === 2 ? [0, 1] : [0, Math.floor((n - 1) / 2), n - 1]
  return picks.map((i, pos) => ({
    i,
    x: xAt(i, n, plot.value.left, plot.value.width),
    text: formatShortDate(props.dates[i]!),
    anchor: pos === 0 ? 'start' : pos === picks.length - 1 ? 'end' : 'middle',
  }))
})

const hover = ref<number | null>(null)
function onMove(event: PointerEvent) {
  const rect = (event.currentTarget as Element).getBoundingClientRect()
  const idx = nearestIndex(event.clientX - rect.left, count.value, plot.value.left, plot.value.width)
  hover.value = idx < 0 ? null : idx
}
function onKey(event: KeyboardEvent) {
  if (count.value === 0) return
  const last = count.value - 1
  if (event.key === 'ArrowLeft') hover.value = Math.max(0, (hover.value ?? last) - 1)
  else if (event.key === 'ArrowRight') hover.value = Math.min(last, (hover.value ?? -1) + 1)
  else if (event.key === 'Escape') hover.value = null
  else return
  event.preventDefault()
}
// Everything the hover marker and tooltip need, computed once so the template stays simple.
const hoverInfo = computed(() => {
  const i = hover.value
  if (i === null || i >= count.value) return null
  const x = xAt(i, count.value, plot.value.left, plot.value.width)
  return {
    x,
    tipLeft: Math.min(86, Math.max(14, (x / width.value) * 100)),
    date: formatShortDate(props.dates[i] ?? ''),
    rows: props.series.map((s) => {
      const value = s.values[i] ?? 0
      return { key: s.key, label: s.label, color: s.color, value, y: yAt(value, max.value, plot.value.top, plot.value.height) }
    }),
  }
})
const dotColor = (c: TrendSeries['color']) => ({ stroke: `rgb(var(--c-${c}))` })
const lineStyle = (c: TrendSeries['color']) => ({ stroke: `rgb(var(--c-${c}))` })
const swatch = (c: TrendSeries['color']) => ({ backgroundColor: `rgb(var(--c-${c}))` })
</script>

<template>
  <div>
    <ul class="mb-3 flex flex-wrap gap-x-5 gap-y-1">
      <li v-for="s in paths" :key="s.key" class="flex items-center gap-2 text-[13px] text-on-surface-variant">
        <span class="h-2.5 w-2.5 rounded-full" :style="swatch(s.color)" />
        {{ s.label }} <span class="font-semibold text-on-surface">{{ formatCompact(s.total) }}</span>
      </li>
    </ul>

    <div ref="box" class="relative">
      <svg
        :width="width"
        :height="HEIGHT"
        :viewBox="`0 0 ${width} ${HEIGHT}`"
        role="img"
        :aria-label="`${label}. Use the left and right arrow keys to read each day.`"
        tabindex="0"
        class="block max-w-full touch-pan-y rounded-lg"
        @pointermove="onMove"
        @pointerdown="onMove"
        @pointerleave="hover = null"
        @blur="hover = null"
        @keydown="onKey"
      >
        <g>
          <line
            v-for="t in ticks"
            :key="t.value"
            :x1="plot.left" :x2="plot.left + plot.width" :y1="t.y" :y2="t.y"
            stroke="currentColor" class="text-outline-variant/50" stroke-width="1"
            :stroke-dasharray="t.value === 0 ? undefined : '3 4'"
          />
          <text
            v-for="t in ticks"
            :key="`l${t.value}`"
            :x="plot.left - 8" :y="t.y + 4" text-anchor="end" font-size="11"
            fill="currentColor" class="text-on-surface-variant"
          >{{ formatCompact(t.value) }}</text>
          <text
            v-for="l in xLabels"
            :key="`x${l.i}`"
            :x="l.x" :y="HEIGHT - 8" :text-anchor="l.anchor" font-size="11"
            fill="currentColor" class="text-on-surface-variant"
          >{{ l.text }}</text>
        </g>

        <path
          v-for="s in paths"
          :key="s.key"
          :d="s.d"
          fill="none" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"
          :style="lineStyle(s.color)"
        />

        <g v-if="hoverInfo">
          <line
            :x1="hoverInfo.x" :x2="hoverInfo.x" :y1="plot.top" :y2="plot.top + plot.height"
            stroke="currentColor" class="text-outline" stroke-width="1"
          />
          <circle
            v-for="row in hoverInfo.rows"
            :key="row.key"
            :cx="hoverInfo.x" :cy="row.y"
            r="4" stroke-width="2" fill="rgb(var(--c-surface-container-lowest))"
            :style="dotColor(row.color)"
          />
        </g>
      </svg>

      <div
        v-if="hoverInfo"
        class="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-[13px] shadow-pop"
        :style="{ left: `${hoverInfo.tipLeft}%` }"
      >
        <p class="font-medium">{{ hoverInfo.date }}</p>
        <p v-for="row in hoverInfo.rows" :key="row.key" class="flex items-center gap-2 text-on-surface-variant">
          <span class="h-2 w-2 rounded-full" :style="swatch(row.color)" />
          {{ row.label }}: <span class="font-semibold text-on-surface">{{ row.value }}</span>
        </p>
      </div>
    </div>
  </div>
</template>
