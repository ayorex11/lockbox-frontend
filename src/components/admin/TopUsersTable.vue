<script setup lang="ts">
import type { TopMetric, TopUser } from '@/lib/api'
import { formatBytes, formatCreated } from '@/lib/format'

defineProps<{ rows: TopUser[]; metric: TopMetric }>()

const cols = 'grid-cols-[2rem_minmax(0,1fr)_auto] md:grid-cols-[2rem_minmax(0,2fr)_5rem_6rem_7rem_8rem]'
const cell = (active: boolean) => (active ? 'font-semibold text-on-surface' : 'text-on-surface-variant')
</script>

<template>
  <div>
    <div class="hidden gap-4 border-b border-outline-variant/40 bg-surface-container-low px-5 py-3 md:grid" :class="cols">
      <span class="eyebrow">#</span><span class="eyebrow">User</span>
      <span class="eyebrow text-right">Links</span><span class="eyebrow text-right">Downloads</span>
      <span class="eyebrow text-right">Data shared</span><span class="eyebrow text-right">Last link</span>
    </div>

    <p v-if="!rows.length" class="px-6 py-12 text-center text-on-surface-variant">No senders to rank yet.</p>

    <ul v-else class="divide-y divide-outline-variant/40">
      <li v-for="(row, i) in rows" :key="row.email" class="grid items-center gap-x-4 gap-y-0.5 px-5 py-3.5 text-sm" :class="cols">
        <span class="font-mono text-xs text-outline">{{ i + 1 }}</span>
        <span class="truncate font-medium" :title="row.email">{{ row.email }}</span>
        <!-- Mobile: just the ranked metric. Desktop: every column. -->
        <span class="text-right tabular-nums md:hidden" :class="cell(true)">
          {{ metric === 'links' ? `${row.links} links` : metric === 'claims' ? `${row.claims} downloads` : formatBytes(row.bytes_shared) }}
        </span>
        <span class="hidden text-right tabular-nums md:block" :class="cell(metric === 'links')">{{ row.links }}</span>
        <span class="hidden text-right tabular-nums md:block" :class="cell(metric === 'claims')">{{ row.claims }}</span>
        <span class="hidden text-right tabular-nums md:block" :class="cell(metric === 'bytes')">{{ formatBytes(row.bytes_shared) }}</span>
        <span class="hidden text-right text-on-surface-variant md:block">{{ row.last_link_at ? formatCreated(row.last_link_at) : '—' }}</span>
      </li>
    </ul>
  </div>
</template>
