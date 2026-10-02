<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FunnelBar from '@/components/admin/FunnelBar.vue'
import SegmentBar from '@/components/admin/SegmentBar.vue'
import TopUsersTable from '@/components/admin/TopUsersTable.vue'
import TrendChart from '@/components/admin/TrendChart.vue'
import BaseButton from '@/components/BaseButton.vue'
import Icon from '@/components/Icon.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import StatCard from '@/components/StatCard.vue'
import { useAsyncData } from '@/composables/useAsyncData'
import { adminApi, type TopMetric } from '@/lib/api'
import type { TrendSeries } from '@/lib/chart'
import { formatBytes, formatDateTime, formatPercent } from '@/lib/format'
import { buildInsights, type InsightSeverity } from '@/lib/insights'

const range = ref<'7' | '30' | '90'>('30')
const metric = ref<TopMetric>('links')

const overview = useAsyncData(() => adminApi.overview())
const timeseries = useAsyncData(() => adminApi.timeseries(Number(range.value)))
const topUsers = useAsyncData(() => adminApi.topUsers(metric.value, 10))
const security = useAsyncData(() => adminApi.security())
const sections = [overview, timeseries, topUsers, security]

const refreshing = computed(() => sections.some((s) => s.loading.value))

function reloadAll(showSpinner = true) {
  void Promise.all(sections.map((s) => s.load(showSpinner)))
}
watch(range, () => void timeseries.load())
watch(metric, () => void topUsers.load())

const onVisible = () => { if (document.visibilityState === 'visible') reloadAll(false) }
onMounted(() => { reloadAll(); document.addEventListener('visibilitychange', onVisible) })
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible))

// ----------------------------------------------------------------- derived data
const o = computed(() => overview.data.value)
const sec = computed(() => security.data.value)
const topRows = computed(() => topUsers.data.value?.results ?? null)
const insights = computed(() => (o.value ? buildInsights(o.value) : []))

const dates = computed(() => timeseries.data.value?.series.map((p) => p.date) ?? [])
const activitySeries = computed<TrendSeries[]>(() => {
  const rows = timeseries.data.value?.series ?? []
  return [
    { key: 'links_created', label: 'Links created', color: 'primary', values: rows.map((r) => r.links_created) },
    { key: 'opens', label: 'Opens', color: 'tertiary', values: rows.map((r) => r.opens) },
    { key: 'claims', label: 'Downloads', color: 'secondary', values: rows.map((r) => r.claims) },
  ]
})
const signupSeries = computed<TrendSeries[]>(() => [
  { key: 'signups', label: 'Sign-ups', color: 'primary', values: timeseries.data.value?.series.map((r) => r.signups) ?? [] },
])
const secDates = computed(() => security.data.value?.series.map((p) => p.date) ?? [])
const securitySeries = computed<TrendSeries[]>(() => {
  const rows = security.data.value?.series ?? []
  return [
    { key: 'password_failed', label: 'Wrong passwords', color: 'tertiary', values: rows.map((r) => r.password_failed) },
    { key: 'locked_out', label: 'Lockouts', color: 'error', values: rows.map((r) => r.locked_out) },
  ]
})

const rangeOptions = [
  { value: '7' as const, label: '7 days' },
  { value: '30' as const, label: '30 days' },
  { value: '90' as const, label: '90 days' },
]
const metricOptions = [
  { value: 'links' as const, label: 'Links' },
  { value: 'claims' as const, label: 'Downloads' },
  { value: 'bytes' as const, label: 'Data' },
]

const tone: Record<InsightSeverity, string> = {
  warn: 'bg-tertiary-container text-on-tertiary-container',
  info: 'bg-surface-container-high text-on-surface-variant',
  good: 'bg-primary-fixed text-on-primary-fixed-variant',
}
const secWindows = [
  { key: '24h' as const, label: 'Last 24 hours' },
  { key: '7d' as const, label: 'Last 7 days' },
  { key: '30d' as const, label: 'Last 30 days' },
]
</script>

<template>
  <div>
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="eyebrow">Admin</p>
        <h1 class="mt-1 text-3xl font-semibold tracking-tight">Insights</h1>
        <p class="mt-1 text-on-surface-variant">
          How people use Lockbox, and where to focus next.
          <span v-if="o" class="hint ml-1">Updated {{ formatDateTime(o.generated_at) }}</span>
        </p>
      </div>
      <BaseButton variant="secondary" icon="refresh" :loading="refreshing" @click="reloadAll()">Refresh</BaseButton>
    </div>

    <!-- Overview failed: nothing else on the page is trustworthy to show -->
    <div v-if="overview.error.value && !o" class="card mt-7 flex flex-col items-center gap-3 px-6 py-14 text-center" role="alert">
      <Icon name="cloud_off" :size="32" class="text-outline" />
      <p class="text-on-surface-variant">{{ overview.error.value }}</p>
      <BaseButton variant="secondary" icon="refresh" @click="reloadAll()">Try again</BaseButton>
    </div>

    <template v-else>
      <!-- Headline numbers -->
      <div class="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" :aria-busy="overview.loading.value">
        <template v-if="o">
          <StatCard label="Users" :value="o.users.total" icon="group" :hint="`${o.users.verified} verified · ${o.users.new_7d} new this week`" />
          <StatCard label="Active senders" :value="o.users.active_senders_30d" icon="send" :hint="`Created a link in 30 days · ${o.users.active_senders_7d} in the last 7`" />
          <StatCard label="Links created" :value="o.links.total" icon="link" :hint="`${o.links.created_7d} this week · ${o.links.active} active now`" />
          <StatCard label="Downloads" :value="o.engagement.claims" icon="download" :hint="`${formatPercent(o.funnels.links.claim_rate)} of links were claimed`" />
          <StatCard label="Open rate" :value="formatPercent(o.funnels.links.open_rate)" icon="visibility" :hint="`${o.funnels.links.never_opened} links never opened`" />
          <StatCard label="Storage in use" :value="formatBytes(o.storage.bytes_in_storage)" icon="cloud" :hint="`${o.storage.files_in_storage} files now · ${formatBytes(o.storage.bytes_shared_all_time)} shared all time`" />
        </template>
        <template v-else>
          <div v-for="n in 6" :key="n" class="card h-[132px] animate-pulse bg-surface-container" />
        </template>
      </div>

      <!-- Where to head next -->
      <section class="card mt-6 p-5 sm:p-6" aria-labelledby="focus-h">
        <h2 id="focus-h" class="text-lg font-semibold">Where to focus next</h2>
        <p class="hint mt-0.5">Plain-language reading of the numbers below. Needs a handful of data points before it says anything.</p>
        <ul v-if="insights.length" class="mt-4 divide-y divide-outline-variant/40">
          <li v-for="item in insights" :key="item.id" class="flex gap-3 py-3.5 first:pt-0 last:pb-0">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" :class="tone[item.severity]">
              <Icon :name="item.icon" :size="18" />
            </span>
            <div class="min-w-0">
              <p class="font-medium">{{ item.title }}</p>
              <p class="mt-0.5 text-sm text-on-surface-variant">{{ item.detail }}</p>
            </div>
          </li>
        </ul>
        <div v-else class="mt-4 h-24 animate-pulse rounded-xl bg-surface-container" />
      </section>

      <!-- Trends -->
      <div class="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">Trends</h2>
        <div class="w-64 max-w-full"><SegmentedControl v-model="range" label="Time range" :options="rangeOptions" /></div>
      </div>
      <p v-if="timeseries.error.value" class="mt-3 flex items-center gap-2 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
        <Icon name="error" fill :size="18" />{{ timeseries.error.value }}
        <button type="button" class="ml-auto font-medium underline" @click="timeseries.load()">Retry</button>
      </p>
      <div class="mt-3 grid gap-4 lg:grid-cols-5">
        <section class="card p-5 lg:col-span-3" aria-labelledby="act-h">
          <h3 id="act-h" class="mb-3 font-semibold">Link activity</h3>
          <TrendChart v-if="dates.length" :dates="dates" :series="activitySeries" label="Links created, opens and downloads per day" />
          <div v-else class="h-[260px] animate-pulse rounded-xl bg-surface-container" />
        </section>
        <section class="card p-5 lg:col-span-2" aria-labelledby="sign-h">
          <h3 id="sign-h" class="mb-3 font-semibold">New sign-ups</h3>
          <TrendChart v-if="dates.length" :dates="dates" :series="signupSeries" label="New sign-ups per day" />
          <div v-else class="h-[260px] animate-pulse rounded-xl bg-surface-container" />
        </section>
      </div>
      <p class="hint mt-2">Days are UTC. “Opens” exclude link previewers and bots; downloads are the most reliable engagement number.</p>

      <!-- Funnels and mix -->
      <h2 class="mt-8 text-lg font-semibold">Funnels</h2>
      <div v-if="o" class="mt-3 grid gap-4 lg:grid-cols-3">
        <section class="card p-5" aria-labelledby="fu-h">
          <h3 id="fu-h" class="mb-1 font-semibold">People</h3>
          <p class="hint mb-4">From sign-up to first link</p>
          <FunnelBar :steps="[
            { label: 'Signed up', value: o.funnels.users.signed_up },
            { label: 'Verified email', value: o.funnels.users.verified },
            { label: 'Created a link', value: o.funnels.users.created_a_link },
          ]" />
        </section>
        <section class="card p-5" aria-labelledby="fl-h">
          <h3 id="fl-h" class="mb-1 font-semibold">Links</h3>
          <p class="hint mb-4">From created to downloaded</p>
          <FunnelBar :steps="[
            { label: 'Created', value: o.funnels.links.created },
            { label: 'Opened', value: o.funnels.links.opened },
            { label: 'Downloaded', value: o.funnels.links.claimed },
          ]" />
          <p v-if="o.funnels.links.expired_never_opened" class="hint mt-4">
            {{ o.funnels.links.expired_never_opened }} expired without ever being opened.
          </p>
        </section>
        <section class="card p-5" aria-labelledby="fm-h">
          <h3 id="fm-h" class="mb-1 font-semibold">How links are used</h3>
          <p class="hint mb-4">Status and options across all links</p>
          <SegmentBar
            label="Links by status"
            :segments="[
              { label: 'Active', value: o.links.active, tone: 'primary' },
              { label: 'Used', value: o.links.used, tone: 'tertiary' },
              { label: 'Expired', value: o.links.expired, tone: 'muted' },
              { label: 'Revoked', value: o.links.revoked, tone: 'error' },
            ]"
          />
          <div class="mt-5">
            <SegmentBar
              label="One-time versus timed links"
              :segments="[
                { label: 'One-time', value: o.links.one_time, tone: 'secondary' },
                { label: 'Timed', value: o.links.timed, tone: 'muted' },
              ]"
            />
          </div>
          <p class="hint mt-4">
            {{ o.links.password_protected }} password-protected ({{ formatPercent(o.links.total ? o.links.password_protected / o.links.total : null) }}).
          </p>
        </section>
      </div>
      <div v-else class="mt-3 grid gap-4 lg:grid-cols-3"><div v-for="n in 3" :key="n" class="card h-52 animate-pulse bg-surface-container" /></div>

      <!-- Top users -->
      <div class="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">Top senders</h2>
        <div class="w-72 max-w-full"><SegmentedControl v-model="metric" label="Rank senders by" :options="metricOptions" /></div>
      </div>
      <div class="card mt-3 overflow-hidden">
        <div v-if="topUsers.loading.value && !topRows" class="space-y-3 p-5" aria-busy="true">
          <div v-for="n in 4" :key="n" class="h-5 animate-pulse rounded bg-surface-container" />
        </div>
        <div v-else-if="topUsers.error.value" class="flex flex-col items-center gap-3 px-6 py-12 text-center" role="alert">
          <p class="text-on-surface-variant">{{ topUsers.error.value }}</p>
          <BaseButton variant="secondary" icon="refresh" @click="topUsers.load()">Try again</BaseButton>
        </div>
        <TopUsersTable v-else-if="topRows" :rows="topRows" :metric="metric" />
      </div>

      <!-- Security -->
      <h2 class="mt-8 text-lg font-semibold">Link passwords and abuse</h2>
      <div class="mt-3 grid gap-4 lg:grid-cols-5">
        <section class="card p-5 lg:col-span-2" aria-labelledby="sec-h">
          <h3 id="sec-h" class="mb-3 font-semibold">Failed attempts</h3>
          <div v-if="sec">
            <dl class="divide-y divide-outline-variant/40">
              <div v-for="w in secWindows" :key="w.key" class="flex items-center justify-between py-2.5 text-sm first:pt-0">
                <dt class="text-on-surface-variant">{{ w.label }}</dt>
                <dd class="tabular-nums">
                  <span class="font-semibold">{{ sec.windows[w.key].password_failed }}</span> wrong passwords ·
                  <span class="font-semibold">{{ sec.windows[w.key].locked_out }}</span> lockouts
                </dd>
              </div>
            </dl>
            <p class="hint mt-3">{{ sec.links_with_failures_7d }} links had a wrong password in the last 7 days.</p>
          </div>
          <p v-else-if="security.error.value" class="text-sm text-on-surface-variant" role="alert">{{ security.error.value }}</p>
          <div v-else class="h-28 animate-pulse rounded-xl bg-surface-container" />
        </section>
        <section class="card p-5 lg:col-span-3" aria-labelledby="secs-h">
          <h3 id="secs-h" class="mb-3 font-semibold">Last 14 days</h3>
          <TrendChart v-if="secDates.length" :dates="secDates" :series="securitySeries" label="Wrong passwords and lockouts per day" />
          <div v-else class="h-[260px] animate-pulse rounded-xl bg-surface-container" />
        </section>
      </div>

      <p class="hint mt-8 flex items-start gap-2">
        <Icon name="info" :size="16" class="mt-px shrink-0" />
        Staff accounts are excluded from every number. “Active” means created at least one link in the period. File names and network addresses are never shown here.
      </p>
    </template>
  </div>
</template>
