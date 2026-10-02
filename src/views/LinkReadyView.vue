<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import CopyButton from '@/components/CopyButton.vue'
import Icon from '@/components/Icon.vue'
import QrModal from '@/components/QrModal.vue'
import { linksApi, type ShareLink } from '@/lib/api'
import { describeError } from '@/lib/errors'
import { buildShareUrl, fileIcon, formatBytes, formatDateTime, timeLeft } from '@/lib/format'
import { useKeyStore } from '@/stores/keys'
import { useToastStore } from '@/stores/toast'

const props = defineProps<{ id: string }>()
const router = useRouter()
const keys = useKeyStore()
const toast = useToastStore()

const link = ref<ShareLink | null>(null)
const loadError = ref('')
const qrOpen = ref(false)
const confirmRevoke = ref(false)
const revoking = ref(false)

const key = computed(() => keys.get(props.id))
const shareUrl = computed(() => (key.value ? buildShareUrl(props.id, key.value) : ''))
const mailto = computed(() => {
  const subject = encodeURIComponent('A private file for you')
  const body = encodeURIComponent(`I've shared a file with you using Lockbox:\n\n${shareUrl.value}\n\nThe link is private, so please don't forward it.`)
  return `mailto:?subject=${subject}&body=${body}`
})

onMounted(async () => {
  // The key only exists on the device that created the link. Without it, this page can't show the full link.
  if (!key.value) return void router.replace({ name: 'link-activity', params: { id: props.id } })
  try {
    link.value = await linksApi.get(props.id)
  } catch (e) {
    loadError.value = describeError(e)
  }
})

function shareByEmail() {
  window.location.href = mailto.value
}

async function revoke() {
  revoking.value = true
  try {
    await linksApi.revoke(props.id)
    keys.remove(props.id)
    toast.success('Link revoked. The file has been deleted.')
    await router.replace({ name: 'dashboard' })
  } catch (e) {
    toast.error(describeError(e))
    revoking.value = false
    confirmRevoke.value = false
  }
}

const accessText = computed(() => {
  if (!link.value) return ''
  const { mode, max_downloads: max, download_count: n } = link.value
  if (mode === 'one_time') return `${n} / 1`
  return max ? `${n} / ${max}` : `${n}`
})
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <p v-if="loadError" class="card p-6 text-center text-on-surface-variant" role="alert">{{ loadError }}</p>

    <div v-else-if="link">
      <div class="text-center">
        <div class="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
          <span class="absolute inset-0 rounded-full bg-primary-container/20 blur-xl" aria-hidden="true" />
          <span class="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary-container text-on-primary-container"><Icon name="lock" fill :size="30" /></span>
        </div>
        <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Your link is ready</h1>
        <p class="mx-auto mt-2 max-w-lg text-on-surface-variant">Your file was locked in this browser. The key is part of the link and is never sent to our servers.</p>
      </div>

      <div class="card mt-8 overflow-hidden">
        <div class="flex items-center justify-between gap-3 bg-surface-container-low px-5 py-3.5">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-on-primary-fixed-variant"><Icon :name="fileIcon(link.file_name)" :size="20" /></span>
            <p class="truncate font-medium">{{ link.file_name }} <span class="hint ml-1">{{ formatBytes(link.file_size) }}</span></p>
          </div>
          <span class="hidden shrink-0 items-center gap-1 rounded-full bg-primary-fixed px-2.5 py-1 text-xs font-medium text-on-primary-fixed-variant sm:inline-flex"><Icon name="lock" fill :size="13" /> Encrypted</span>
        </div>
        <div class="p-5">
          <label for="share-link" class="label">Private link</label>
          <div class="flex flex-col gap-2 sm:flex-row">
            <input id="share-link" :value="shareUrl" readonly class="field flex-1 font-mono text-[13px]" @focus="($event.target as HTMLInputElement).select()" />
            <CopyButton :text="shareUrl" variant="primary" size="lg" />
          </div>
          <p class="hint mt-2">The part after “#” is the key. Share the whole link, or it won't open.</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <BaseButton variant="soft" size="sm" icon="mail" @click="shareByEmail">Share via email</BaseButton>
            <BaseButton variant="soft" size="sm" icon="qr_code_2" @click="qrOpen = true">Show QR code</BaseButton>
          </div>
          <p class="hint mt-3">Emailing the link puts the key in the message. For sensitive files, use a password and send it on a different channel.</p>
        </div>
      </div>

      <h2 class="mb-3 mt-8 flex items-center gap-2 font-semibold"><Icon name="verified_user" fill class="text-primary" /> Safeguards on this link</h2>
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="card p-5">
          <p class="flex items-center justify-between text-sm text-on-surface-variant">{{ link.mode === 'one_time' ? 'Self-destruct' : 'Download limit' }}<Icon :name="link.mode === 'one_time' ? 'local_fire_department' : 'download'" :size="18" class="text-primary" /></p>
          <p class="mt-2 text-xl font-semibold">{{ link.mode === 'one_time' ? '1 download' : link.max_downloads ? `${link.max_downloads} downloads` : 'No limit' }}</p>
          <p class="hint mt-0.5">{{ link.mode === 'one_time' ? 'Deleted after the first download' : 'Until the time limit passes' }}</p>
        </div>
        <div class="card p-5">
          <p class="flex items-center justify-between text-sm text-on-surface-variant">Time limit<Icon name="schedule" :size="18" class="text-primary" /></p>
          <p class="mt-2 text-xl font-semibold">{{ timeLeft(link.expires_at) }} left</p>
          <p class="hint mt-0.5">Expires {{ formatDateTime(link.expires_at) }}</p>
        </div>
        <div class="card p-5">
          <p class="flex items-center justify-between text-sm text-on-surface-variant">Downloads so far<Icon name="visibility" :size="18" class="text-primary" /></p>
          <p class="mt-2 text-xl font-semibold">{{ accessText }}</p>
          <p class="hint mt-0.5">{{ link.requires_password ? 'Password protected' : 'No password' }}</p>
        </div>
      </div>

      <div class="mt-6 flex gap-3 rounded-2xl bg-tertiary-container p-5 text-on-tertiary-container">
        <Icon name="info" fill class="mt-0.5 shrink-0" />
        <div class="text-sm">
          <p class="font-medium">Anyone with this full link can open the file. Share it only with people you trust.</p>
          <p class="mt-1 opacity-90">This device remembers the key so you can copy the link again from My files. It's cleared when you log out, and the key can't be recovered from our servers.</p>
        </div>
      </div>

      <div class="mt-8 flex flex-col items-center gap-3">
        <div class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <BaseButton variant="secondary" size="lg" icon="add" :to="{ name: 'send' }">Send another</BaseButton>
          <BaseButton size="lg" icon-right="arrow_forward" :to="{ name: 'dashboard' }">Go to My files</BaseButton>
        </div>
        <BaseButton variant="ghost" size="sm" icon="block" class="!text-error" @click="confirmRevoke = true">Revoke this link</BaseButton>
      </div>
    </div>

    <div v-else class="flex justify-center py-24"><div class="h-10 w-10 animate-spin rounded-full border-4 border-primary-fixed border-t-primary" aria-label="Loading" /></div>

    <QrModal :open="qrOpen" :text="shareUrl" @close="qrOpen = false" />
    <ConfirmModal :open="confirmRevoke" danger title="Revoke this link?" message="The file will be deleted and the link will stop working immediately. This can't be undone." confirm-label="Revoke and delete" :loading="revoking" @confirm="revoke" @cancel="confirmRevoke = false" />
  </div>
</template>
