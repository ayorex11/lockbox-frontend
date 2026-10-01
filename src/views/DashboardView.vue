<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BaseButton from '@/components/BaseButton.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import Icon from '@/components/Icon.vue'
import LinkRow from '@/components/LinkRow.vue'
import StatCard from '@/components/StatCard.vue'
import { useNow } from '@/composables/useNow'
import { linksApi, type LinkPage, type LinkStats, type LinkStatus, type ShareLink } from '@/lib/api'
import { describeError } from '@/lib/errors'
import { buildShareUrl } from '@/lib/format'
import { useKeyStore } from '@/stores/keys'
import { useToastStore } from '@/stores/toast'

type Filter = 'all' | LinkStatus

const keys = useKeyStore()
const toast = useToastStore()
const now = useNow(30_000)

const filter = ref<Filter>('all')
const page = ref(1)
const data = ref<LinkPage | null>(null)
const loading = ref(true)
const loadError = ref('')
const search = ref('')
const toRevoke = ref<ShareLink | null>(null)
const revoking = ref(false)

const emptyStats: LinkStats = { total: 0, active: 0, used: 0, expired: 0, revoked: 0, total_claims: 0 }
const stats = computed(() => data.value?.stats ?? emptyStats)
const tabs = computed(() => [
  { id: 'all' as const, label: 'All', count: stats.value.total },
  { id: 'active' as const, label: 'Active', count: stats.value.active },
  { id: 'used' as const, label: 'Used', count: stats.value.used },
  { id: 'expired' as const, label: 'Expired', count: stats.value.expired },
  { id: 'revoked' as const, label: 'Revoked', count: stats.value.revoked },
])
const visible = computed(() => {
  const term = search.value.trim().toLowerCase()
  const rows = data.value?.results ?? []
  return term ? rows.filter((l) => l.file_name.toLowerCase().includes(term)) : rows
})
const pageCount = computed(() => Math.max(1, Math.ceil((data.value?.count ?? 0) / 25)))
const hasAnyLinks = computed(() => stats.value.total > 0)

async function load(showSpinner = true) {
  if (showSpinner) loading.value = true
  loadError.value = ''
  try {
    data.value = await linksApi.list({ status: filter.value, page: page.value })
  } catch (e) {
    loadError.value = describeError(e)
  } finally {
    loading.value = false
  }
}

watch(filter, () => { page.value = 1; void load() })
watch(page, () => void load())

const onVisible = () => { if (document.visibilityState === 'visible') void load(false) }
onMounted(() => { void load(); document.addEventListener('visibilitychange', onVisible) })
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible))

function shareUrlFor(link: ShareLink): string | null {
  const key = keys.get(link.id)
  return key ? buildShareUrl(link.id, key) : null
}

async function confirmRevoke() {
  if (!toRevoke.value) return
  revoking.value = true
  try {
    await linksApi.revoke(toRevoke.value.id)
    keys.remove(toRevoke.value.id)
    toast.success('Link revoked. The file has been deleted.')
    toRevoke.value = null
    await load(false)
  } catch (e) {
    toast.error(describeError(e))
  } finally {
    revoking.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-3xl font-semibold tracking-tight">My files</h1>
        <p class="mt-1 text-on-surface-variant">Every link you've created, who opened it, and a way to switch it off.</p>
      </div>
      <div class="flex gap-2">
        <div class="relative flex-1 sm:w-64">
          <Icon name="search" :size="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input v-model="search" type="search" class="field !py-2.5 pl-10" placeholder="Search this page…" aria-label="Search files on this page" />
        </div>
        <BaseButton :to="{ name: 'send' }" icon="add">New link</BaseButton>
      </div>
    </div>

    <div class="mt-7 grid gap-4 sm:grid-cols-3">
      <StatCard label="Active links" :value="stats.active" icon="lock" hint="Ready for a recipient to download" />
      <StatCard label="Total downloads" :value="stats.total_claims" icon="download" hint="Across all your links" />
      <StatCard label="Finished links" :value="stats.expired + stats.revoked + stats.used" icon="auto_delete" hint="Used, expired or revoked. Files deleted" />
    </div>

    <div class="mt-8 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter links by status">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        role="tab"
        :aria-selected="filter === tab.id"
        class="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
        :class="filter === tab.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'"
        @click="filter = tab.id"
      >
        {{ tab.label }} <span class="ml-0.5 opacity-70">{{ tab.count }}</span>
      </button>
    </div>

    <div class="card mt-4 overflow-hidden">
      <div class="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] gap-4 border-b border-outline-variant/40 bg-surface-container-low px-5 py-3 md:grid">
        <span class="eyebrow">File</span><span class="eyebrow">Status</span><span class="eyebrow">Created</span><span class="eyebrow">Downloads</span>
        <span class="eyebrow w-[108px] text-right">Actions</span>
      </div>

      <div v-if="loading" class="divide-y divide-outline-variant/40" aria-busy="true" aria-label="Loading your links">
        <div v-for="n in 4" :key="n" class="flex items-center gap-3 px-5 py-5">
          <div class="h-11 w-11 animate-pulse rounded-xl bg-surface-container" />
          <div class="flex-1 space-y-2"><div class="h-3.5 w-1/3 animate-pulse rounded bg-surface-container" /><div class="h-3 w-1/4 animate-pulse rounded bg-surface-container" /></div>
        </div>
      </div>

      <div v-else-if="loadError" class="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <Icon name="cloud_off" :size="32" class="text-outline" />
        <p class="text-on-surface-variant">{{ loadError }}</p>
        <BaseButton variant="secondary" icon="refresh" @click="load()">Try again</BaseButton>
      </div>

      <div v-else-if="!hasAnyLinks" class="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span class="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-fixed text-on-primary-fixed-variant"><Icon name="lock" fill :size="30" /></span>
        <h2 class="text-xl font-semibold">Nothing shared yet</h2>
        <p class="max-w-sm text-on-surface-variant">Send a contract, an ID or an invoice. It's locked in your browser first, and you control when it disappears.</p>
        <BaseButton :to="{ name: 'send' }" icon="add" class="mt-2">Send your first file</BaseButton>
      </div>

      <div v-else-if="!visible.length" class="px-6 py-14 text-center text-on-surface-variant">
        {{ search ? `No files on this page match “${search}”.` : 'No links with this status.' }}
      </div>

      <div v-else class="divide-y divide-outline-variant/40">
        <LinkRow v-for="link in visible" :key="link.id" :link="link" :share-url="shareUrlFor(link)" :now="now" @revoke="toRevoke = $event" />
      </div>
    </div>

    <div v-if="pageCount > 1" class="mt-4 flex items-center justify-between">
      <BaseButton variant="secondary" size="sm" icon="chevron_left" :disabled="page <= 1" @click="page--">Previous</BaseButton>
      <span class="hint">Page {{ page }} of {{ pageCount }}</span>
      <BaseButton variant="secondary" size="sm" icon-right="chevron_right" :disabled="page >= pageCount" @click="page++">Next</BaseButton>
    </div>

    <p class="hint mt-6 flex items-start gap-2">
      <Icon name="info" :size="16" class="mt-px shrink-0" />
      “Copy link” is available for links created on this device. The decryption key is never stored on our servers, so it can't be recovered from anywhere else.
    </p>

    <ConfirmModal
      :open="!!toRevoke"
      danger
      title="Revoke this link?"
      :message="`“${toRevoke?.file_name ?? ''}” will be deleted and the link will stop working immediately. This can't be undone.`"
      confirm-label="Revoke and delete"
      :loading="revoking"
      @confirm="confirmRevoke"
      @cancel="toRevoke = null"
    />
  </div>
</template>
