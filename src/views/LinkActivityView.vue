<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import CopyButton from '@/components/CopyButton.vue'
import Icon from '@/components/Icon.vue'
import StatCard from '@/components/StatCard.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useNow } from '@/composables/useNow'
import { ApiError, linksApi, type AuditEvent, type AuditEventType, type ShareLink } from '@/lib/api'
import { describeError } from '@/lib/errors'
import { buildShareUrl, displayNetwork, fileIcon, formatBytes, formatDateTime, timeLeft } from '@/lib/format'
import { summarizeUserAgent } from '@/lib/ua'
import { useKeyStore } from '@/stores/keys'
import { useToastStore } from '@/stores/toast'

const props = defineProps<{ id: string }>()
const keys = useKeyStore()
const toast = useToastStore()
const now = useNow(30_000)

const link = ref<ShareLink | null>(null)
const events = ref<AuditEvent[]>([])
const nextPage = ref<number | null>(null)
const loadingMore = ref(false)
const notFound = ref(false)
const loadError = ref('')
const confirmRevoke = ref(false)
const revoking = ref(false)
let poll: ReturnType<typeof setInterval> | undefined

const shareUrl = computed(() => {
  const key = keys.get(props.id)
  return key ? buildShareUrl(props.id, key) : null
})
const isLive = computed(() => link.value?.status === 'active')

const eventMeta: Record<AuditEventType, { icon: string; title: string; detail: string; tone: 'ok' | 'info' | 'warn' | 'bad' }> = {
  link_created: { icon: 'add_link', title: 'Private link created', detail: 'File locked in the browser and uploaded as scrambled data.', tone: 'info' },
  opened: { icon: 'visibility', title: 'Link opened', detail: 'Someone loaded the download page.', tone: 'info' },
  password_failed: { icon: 'key_off', title: 'Wrong password entered', detail: 'A download attempt was stopped. Nothing was consumed.', tone: 'warn' },
  locked_out: { icon: 'lock_clock', title: 'Link locked', detail: "Too many wrong passwords. It is paused for 15 minutes.", tone: 'bad' },
  claimed: { icon: 'download_done', title: 'Download started', detail: 'The encrypted file was handed to the recipient’s browser.', tone: 'ok' },
  revoked: { icon: 'block', title: 'Link revoked', detail: 'You switched this link off and the file was deleted.', tone: 'bad' },
  expired_cleanup: { icon: 'auto_delete', title: 'Link expired', detail: 'The file was deleted after the link ran out.', tone: 'info' },
}
const toneClass = { ok: 'bg-primary text-on-primary', info: 'bg-surface-container-high text-on-surface-variant', warn: 'bg-tertiary-container text-on-tertiary-container', bad: 'bg-error-container text-on-error-container' }

async function load() {
  try {
    const [l, e] = await Promise.all([linksApi.get(props.id), linksApi.events(props.id)])
    link.value = l
    events.value = e.results
    nextPage.value = e.next ? 2 : null
    loadError.value = ''
    if (!isLive.value) clearInterval(poll)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound.value = true
    else loadError.value = describeError(e)
    clearInterval(poll)
  }
}

async function loadMore() {
  if (!nextPage.value) return
  loadingMore.value = true
  try {
    const page = await linksApi.events(props.id, nextPage.value)
    events.value = [...events.value, ...page.results]
    nextPage.value = page.next ? nextPage.value + 1 : null
  } catch (e) {
    toast.error(describeError(e))
  } finally {
    loadingMore.value = false
  }
}

onMounted(async () => {
  await load()
  poll = setInterval(() => { if (document.visibilityState === 'visible') void load() }, 15_000)
})
onBeforeUnmount(() => clearInterval(poll))

async function revoke() {
  revoking.value = true
  try {
    link.value = await linksApi.revoke(props.id)
    keys.remove(props.id)
    toast.success('Link revoked. The file has been deleted.')
    confirmRevoke.value = false
    await load()
  } catch (e) {
    toast.error(describeError(e))
  } finally {
    revoking.value = false
  }
}

const downloads = computed(() => {
  if (!link.value) return ''
  const { mode, max_downloads: max, download_count: n } = link.value
  return mode === 'one_time' ? `${n} / 1` : max ? `${n} / ${max}` : String(n)
})
const lifespan = computed(() => {
  if (!link.value) return ''
  if (link.value.status === 'active') return timeLeft(link.value.expires_at, now.value)
  return { used: 'Used', expired: 'Expired', revoked: 'Revoked', active: '' }[link.value.status]
})
</script>

<template>
  <div>
    <nav class="mb-5 flex items-center gap-2 text-sm text-on-surface-variant" aria-label="Breadcrumb">
      <RouterLink :to="{ name: 'dashboard' }" class="inline-flex items-center gap-1 hover:text-on-surface"><Icon name="arrow_back" :size="16" /> My files</RouterLink>
      <span aria-hidden="true">/</span>
      <span class="truncate text-on-surface">{{ link?.file_name ?? 'Activity' }}</span>
    </nav>

    <div v-if="notFound" class="card mx-auto max-w-md p-8 text-center">
      <Icon name="link_off" :size="32" class="text-outline" />
      <h1 class="mt-3 text-xl font-semibold">Link not found</h1>
      <p class="mt-1 text-on-surface-variant">It may belong to another account.</p>
      <BaseButton class="mt-5" :to="{ name: 'dashboard' }" block>Back to My files</BaseButton>
    </div>

    <p v-else-if="loadError && !link" class="card p-6 text-center text-on-surface-variant" role="alert">{{ loadError }}</p>

    <div v-else-if="link">
      <div class="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div class="flex min-w-0 items-center gap-4">
          <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-fixed text-on-primary-fixed-variant"><Icon :name="fileIcon(link.file_name)" :size="28" /></span>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="truncate text-2xl font-semibold tracking-tight">{{ link.file_name }}</h1>
              <StatusBadge :status="link.status" />
            </div>
            <p class="hint mt-1">{{ formatBytes(link.file_size) }} · Created {{ formatDateTime(link.created_at) }}</p>
          </div>
        </div>
        <div class="flex shrink-0 gap-2">
          <CopyButton v-if="link.status === 'active'" :text="shareUrl" disabled-hint="The key for this link is only kept on the device that created it." />
          <BaseButton v-if="link.status === 'active'" variant="danger-soft" icon="block" @click="confirmRevoke = true">Revoke</BaseButton>
        </div>
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Downloads" :value="downloads" icon="download" :hint="link.mode === 'one_time' ? 'Self-destructs after the first download' : link.max_downloads ? 'Limit set on this link' : 'No download limit'" />
        <StatCard :label="link.status === 'active' ? 'Time left' : 'Lifespan'" :value="lifespan" icon="schedule" :hint="`Expires ${formatDateTime(link.expires_at)}`" />
        <StatCard label="Protection" :value="link.requires_password ? 'Password' : 'Link only'" icon="key" :hint="link.requires_password ? 'Locks for 15 min after 5 wrong tries' : 'Anyone with the full link can open it'" />
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section class="card p-5 sm:p-6" aria-label="Activity timeline">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">Activity</h2>
            <span v-if="isLive" class="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-2.5 py-1 text-xs font-medium text-on-primary-fixed-variant">
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Live
            </span>
          </div>

          <p v-if="!events.length" class="py-10 text-center text-on-surface-variant">No activity yet.</p>
          <ol v-else class="mt-5">
            <li v-for="(event, i) in events" :key="event.id" class="relative flex gap-4 pb-6 last:pb-0">
              <span v-if="i < events.length - 1" class="absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-px bg-outline-variant/60" aria-hidden="true" />
              <span class="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full" :class="toneClass[eventMeta[event.event_type].tone]">
                <Icon :name="eventMeta[event.event_type].icon" :size="20" />
              </span>
              <div class="min-w-0 flex-1 rounded-xl bg-surface-container-low p-4">
                <div class="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
                  <p class="font-medium">{{ eventMeta[event.event_type].title }}</p>
                  <time class="hint" :datetime="event.created_at">{{ formatDateTime(event.created_at) }}</time>
                </div>
                <p class="hint mt-0.5">{{ eventMeta[event.event_type].detail }}</p>
                <p v-if="event.ip_truncated || event.user_agent" class="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-on-surface-variant">
                  <span v-if="event.ip_truncated" class="inline-flex items-center gap-1"><Icon name="public" :size="14" />{{ displayNetwork(event.ip_truncated) }}</span>
                  <span v-if="event.user_agent" class="inline-flex items-center gap-1"><Icon name="devices" :size="14" />{{ summarizeUserAgent(event.user_agent) }}</span>
                </p>
              </div>
            </li>
          </ol>
          <BaseButton v-if="nextPage" class="mt-5" variant="secondary" block :loading="loadingMore" @click="loadMore">Load older activity</BaseButton>
        </section>

        <aside class="space-y-4">
          <div class="card p-5">
            <h2 class="font-semibold">Link settings</h2>
            <dl class="mt-4 divide-y divide-outline-variant/40 text-sm">
              <div class="flex items-start justify-between gap-3 py-3"><dt class="text-on-surface-variant">Type</dt><dd class="text-right font-medium">{{ link.mode === 'one_time' ? 'One-time' : 'Timed' }}</dd></div>
              <div class="flex items-start justify-between gap-3 py-3"><dt class="text-on-surface-variant">Password</dt><dd class="text-right font-medium">{{ link.requires_password ? 'Required' : 'None' }}</dd></div>
              <div class="flex items-start justify-between gap-3 py-3"><dt class="text-on-surface-variant">Your email shown</dt><dd class="text-right font-medium">{{ link.show_sender_email ? 'Yes' : 'No' }}</dd></div>
              <div class="flex items-start justify-between gap-3 py-3"><dt class="text-on-surface-variant">Expires</dt><dd class="text-right font-medium">{{ formatDateTime(link.expires_at) }}</dd></div>
            </dl>
            <p class="hint mt-2">Settings are fixed once a link is created. Revoke it and send a new one to change them.</p>
          </div>
          <div class="card p-5">
            <h2 class="flex items-center gap-2 font-semibold"><Icon name="privacy_tip" class="text-primary" /> About this log</h2>
            <p class="hint mt-2">We record the time, a shortened network address (never the full IP) and the browser type. We never see the file's contents.</p>
          </div>
        </aside>
      </div>
    </div>

    <div v-else class="flex justify-center py-24"><div class="h-10 w-10 animate-spin rounded-full border-4 border-primary-fixed border-t-primary" aria-label="Loading" /></div>

    <ConfirmModal :open="confirmRevoke" danger title="Revoke this link?" message="The file will be deleted and the link will stop working immediately. This can't be undone." confirm-label="Revoke and delete" :loading="revoking" @confirm="revoke" @cancel="confirmRevoke = false" />
  </div>
</template>
