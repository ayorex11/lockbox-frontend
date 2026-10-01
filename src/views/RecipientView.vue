<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'
import Icon from '@/components/Icon.vue'
import PasswordField from '@/components/PasswordField.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import { useNow } from '@/composables/useNow'
import { recipientApi, type GoneReason, type LinkMeta } from '@/lib/api'
import { parseKeyFromHash } from '@/lib/crypto'
import { describeError } from '@/lib/errors'
import { saveBytes } from '@/lib/download'
import { fileIcon, formatBytes, formatClock, timeLeft } from '@/lib/format'
import { claimAndDecrypt, type RecipientPhase } from '@/lib/recipientFlow'

type View =
  | 'loading' | 'ready' | 'no_key' | 'working' | 'done'
  | 'gone' | 'locked' | 'download_failed' | 'decrypt_failed' | 'load_error'

const route = useRoute()
const token = computed(() => String(route.params.token))
const now = useNow(30_000)

const view = ref<View>('loading')
const meta = ref<LinkMeta | null>(null)
const goneReason = ref<GoneReason>('unavailable')
const password = ref('')
const passwordError = ref('')
const notice = ref('')
const phase = ref<RecipientPhase>('claiming')
const progress = ref<number | null>(null)
const lockedFor = ref(0)
const loadMessage = ref('')
let lockTimer: ReturnType<typeof setInterval> | undefined
let abort: AbortController | undefined

// The key comes from the URL fragment. It is read in the browser and never sent anywhere.
const key = ref<string | null>(parseKeyFromHash(window.location.hash))

const isOneTime = computed(() => meta.value?.mode === 'one_time')
const phaseLabel = computed(() => ({
  claiming: 'Checking your link…',
  downloading: 'Downloading the locked file…',
  unlocking: 'Unlocking on your device…',
}[phase.value]))

async function loadMeta() {
  view.value = 'loading'
  abort?.abort()
  abort = new AbortController()
  try {
    const result = await recipientApi.meta(token.value, abort.signal)
    if (!result.available) {
      goneReason.value = result.reason
      view.value = 'gone'
      return
    }
    meta.value = result
    view.value = key.value ? 'ready' : 'no_key'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    loadMessage.value = describeError(e)
    view.value = 'load_error'
  }
}
// If the full link is pasted into this same tab, only the #fragment changes and the page doesn't
// reload. Pick the new key up so "incomplete link" screens recover on their own.
function onHashChange() {
  key.value = parseKeyFromHash(window.location.hash)
  if (view.value === 'no_key' && key.value) view.value = 'ready'
  else if (view.value === 'ready' && !key.value) view.value = 'no_key'
}
onMounted(() => {
  window.addEventListener('hashchange', onHashChange)
  void loadMeta()
})
onBeforeUnmount(() => {
  window.removeEventListener('hashchange', onHashChange)
  abort?.abort()
  clearInterval(lockTimer)
})

function startLock(seconds: number) {
  lockedFor.value = Math.max(1, Math.round(seconds))
  view.value = 'locked'
  clearInterval(lockTimer)
  lockTimer = setInterval(() => {
    lockedFor.value -= 1
    if (lockedFor.value <= 0) {
      clearInterval(lockTimer)
      view.value = 'ready'
    }
  }, 1000)
}

async function download() {
  if (!meta.value || !key.value) return
  passwordError.value = ''
  notice.value = ''
  view.value = 'working'
  progress.value = null
  try {
    const outcome = await claimAndDecrypt(
      token.value,
      key.value,
      meta.value.requires_password ? password.value : undefined,
      { onPhase: (p) => (phase.value = p), onProgress: (f) => (progress.value = f) },
    )
    switch (outcome.kind) {
      case 'ok':
        saveBytes(outcome.bytes, meta.value.name)
        password.value = ''
        view.value = 'done'
        break
      case 'gone':
        goneReason.value = outcome.reason
        view.value = 'gone'
        break
      case 'wrong_password':
        passwordError.value = `Wrong password. ${outcome.attemptsLeft} ${outcome.attemptsLeft === 1 ? 'try' : 'tries'} left.`
        view.value = 'ready'
        break
      case 'password_required':
        passwordError.value = 'Enter the password the sender gave you.'
        view.value = 'ready'
        break
      case 'locked':
        startLock(outcome.retryAfter)
        break
      case 'throttled':
        notice.value = 'Too many attempts from this network. Please wait a minute and try again.'
        view.value = 'ready'
        break
      case 'network':
        notice.value = "Couldn't reach Lockbox. Check your connection and try again. Nothing was used up."
        view.value = 'ready'
        break
      case 'download_failed':
        view.value = 'download_failed'
        break
      case 'decrypt_failed':
        view.value = 'decrypt_failed'
        break
    }
  } catch (e) {
    notice.value = describeError(e)
    view.value = 'ready'
  }
}

function tryAgain() {
  view.value = meta.value ? 'ready' : 'loading'
  if (!meta.value) void loadMeta()
}
</script>

<template>
  <div>
    <!-- loading -->
    <div v-if="view === 'loading'" class="card p-8" aria-busy="true" aria-label="Loading">
      <div class="mx-auto h-14 w-14 animate-pulse rounded-full bg-surface-container" />
      <div class="mx-auto mt-5 h-5 w-2/3 animate-pulse rounded bg-surface-container" />
      <div class="mt-6 h-20 animate-pulse rounded-xl bg-surface-container" />
      <div class="mt-4 h-12 animate-pulse rounded-xl bg-surface-container" />
    </div>

    <!-- ready / working -->
    <div v-else-if="(view === 'ready' || view === 'working') && meta" class="card p-6 sm:p-8">
      <div class="text-center">
        <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed-variant"><Icon name="shield_lock" fill :size="28" /></span>
        <p class="eyebrow inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1"><span class="h-1.5 w-1.5 rounded-full bg-primary" /> End-to-end encrypted transfer</p>
        <h1 class="mt-3 text-2xl font-semibold tracking-tight">Private file shared with you</h1>
        <p v-if="meta.sender_email" class="mt-1 text-sm text-on-surface-variant">From <strong class="text-on-surface">{{ meta.sender_email }}</strong></p>
      </div>

      <div class="mt-6 flex items-center gap-3 rounded-xl bg-surface-container-low p-4">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest text-primary shadow-sm"><Icon :name="fileIcon(meta.name)" :size="24" /></span>
        <div class="min-w-0"><p class="truncate font-medium">{{ meta.name }}</p><p class="hint">{{ formatBytes(meta.size) }} · locked</p></div>
      </div>

      <div class="mt-3 rounded-xl p-4" :class="isOneTime ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-container-low'">
        <p class="flex items-center justify-between gap-3 text-sm font-medium">
          <span class="inline-flex items-center gap-2"><Icon :name="isOneTime ? 'local_fire_department' : 'schedule'" fill :size="18" />{{ isOneTime ? 'This link works once' : 'Timed link' }}</span>
          <span class="font-mono text-xs">Expires in {{ timeLeft(meta.expires_at, now) }}</span>
        </p>
        <p class="mt-1 text-[13px] opacity-90">{{ isOneTime ? 'After you download it, the file is deleted and this link stops working.' : 'You can download it until the time runs out.' }}</p>
      </div>

      <form class="mt-5 space-y-3" @submit.prevent="download">
        <PasswordField v-if="meta.requires_password" id="link-password" v-model="password" label="Password from the sender" placeholder="Enter password" autocomplete="off" :invalid="!!passwordError" />
        <p v-if="passwordError" class="flex items-center gap-1.5 text-[13px] text-error" role="alert"><Icon name="error" fill :size="16" />{{ passwordError }}</p>
        <p v-if="notice" class="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">{{ notice }}</p>

        <div v-if="view === 'working'" class="space-y-2 rounded-xl bg-surface-container-low p-4" aria-live="polite">
          <div class="flex items-center justify-between text-sm"><span class="font-medium">{{ phaseLabel }}</span><span v-if="phase === 'downloading' && progress != null" class="font-mono text-primary">{{ Math.round(progress * 100) }}%</span></div>
          <ProgressBar :value="phase === 'downloading' ? progress : null" :label="phaseLabel" />
        </div>

        <BaseButton type="submit" size="lg" block icon="lock_open" :loading="view === 'working'" :disabled="meta.requires_password && !password">Unlock &amp; download</BaseButton>
      </form>

      <p class="hint mt-4 flex items-center justify-center gap-1.5 text-center"><Icon name="verified_user" :size="15" /> Locked until it reaches you. Decrypted on your device only.</p>
    </div>

    <!-- key missing from the link -->
    <div v-else-if="view === 'no_key'" class="card p-8 text-center">
      <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container"><Icon name="key_off" :size="28" /></span>
      <h1 class="text-2xl font-semibold tracking-tight">This link is incomplete</h1>
      <p class="mt-2 text-on-surface-variant">The part of the link after the “#” is the key that unlocks the file, and it's missing. It may have been cut off when the link was copied or pasted.</p>
      <p class="mt-3 text-sm text-on-surface-variant">Ask the sender to share the full link again. Nothing has been used up.</p>
    </div>

    <!-- locked -->
    <div v-else-if="view === 'locked'" class="card p-8 text-center" role="alert">
      <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-on-error-container"><Icon name="lock_clock" :size="28" /></span>
      <h1 class="text-2xl font-semibold tracking-tight">Too many wrong passwords</h1>
      <p class="mt-2 text-on-surface-variant">To protect the file, this link is paused. Try again in</p>
      <p class="mt-2 font-mono text-3xl font-semibold text-on-surface">{{ formatClock(lockedFor) }}</p>
    </div>

    <!-- done -->
    <div v-else-if="view === 'done' && meta" class="card p-8 text-center">
      <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary"><Icon name="check" :size="30" /></span>
      <h1 class="text-2xl font-semibold tracking-tight">Download complete</h1>
      <p class="mt-2 text-on-surface-variant"><span class="font-medium text-on-surface">{{ meta.name }}</span> ({{ formatBytes(meta.size) }}) was unlocked and saved to your device.</p>
      <p v-if="isOneTime" class="mt-4 inline-flex items-center gap-2 rounded-full bg-tertiary-container px-3 py-1.5 text-sm font-medium text-on-tertiary-container"><Icon name="local_fire_department" fill :size="16" /> This link can't be used again.</p>
      <p v-else class="hint mt-4">You can download it again while the link is still valid.</p>
      <div class="mt-7 rounded-xl bg-surface-container-low p-4 text-left">
        <p class="font-medium">Need to send something privately?</p>
        <p class="hint mt-0.5">Lock a file in your browser and share a link that expires. Free.</p>
        <BaseButton class="mt-3" :to="{ name: 'send' }" block icon-right="arrow_forward">Send a file with Lockbox</BaseButton>
      </div>
    </div>

    <!-- gone: deliberately no file name or sender -->
    <div v-else-if="view === 'gone'" class="card p-8 text-center">
      <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"><Icon :name="goneReason === 'expired' ? 'hourglass_bottom' : 'link_off'" :size="28" /></span>
      <h1 class="text-2xl font-semibold tracking-tight">{{ goneReason === 'expired' ? 'This link has expired' : 'This link is no longer available' }}</h1>
      <p class="mt-2 text-on-surface-variant">
        {{ goneReason === 'expired'
          ? 'The sender set a time limit and it has passed. Ask them to send a new link.'
          : 'It may have already been used, or the sender switched it off. Ask them for a new link.' }}
      </p>
      <div class="mt-7 space-y-2">
        <BaseButton :to="{ name: 'send' }" block icon="add">Send a file with Lockbox</BaseButton>
        <BaseButton :to="{ name: 'landing', hash: '#how-it-works' }" variant="ghost" block>How Lockbox works</BaseButton>
      </div>
    </div>

    <!-- failures after the claim -->
    <div v-else-if="view === 'download_failed'" class="card p-8 text-center" role="alert">
      <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-on-error-container"><Icon name="cloud_off" :size="28" /></span>
      <h1 class="text-2xl font-semibold tracking-tight">The download didn't finish</h1>
      <p class="mt-2 text-on-surface-variant">
        {{ isOneTime
          ? 'This was a one-time link, so it has now been used up. Ask the sender to create a new link.'
          : 'Your connection may have dropped. You can try again.' }}
      </p>
      <BaseButton v-if="!isOneTime" class="mt-6" block icon="refresh" @click="tryAgain">Try again</BaseButton>
    </div>

    <div v-else-if="view === 'decrypt_failed'" class="card p-8 text-center" role="alert">
      <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-on-error-container"><Icon name="key_off" :size="28" /></span>
      <h1 class="text-2xl font-semibold tracking-tight">Couldn't unlock this file</h1>
      <p class="mt-2 text-on-surface-variant">The key in the link doesn't match the file. The link may have been changed or only partly copied.</p>
      <p v-if="isOneTime" class="mt-3 text-sm text-on-surface-variant">Because this was a one-time link, it can't be used again. Ask the sender for a new one.</p>
      <BaseButton v-else class="mt-6" block icon="refresh" variant="secondary" @click="tryAgain">Back</BaseButton>
    </div>

    <!-- load error -->
    <div v-else-if="view === 'load_error'" class="card p-8 text-center" role="alert">
      <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"><Icon name="cloud_off" :size="28" /></span>
      <h1 class="text-xl font-semibold">We couldn't load this link</h1>
      <p class="mt-2 text-on-surface-variant">{{ loadMessage }}</p>
      <BaseButton class="mt-6" block icon="refresh" @click="loadMeta">Try again</BaseButton>
    </div>

    <p v-if="view === 'ready' || view === 'no_key'" class="mt-5 text-center text-sm text-on-surface-variant">
      Need to send a file yourself? <RouterLink :to="{ name: 'send' }" class="font-medium text-primary hover:underline">Try Lockbox</RouterLink>
    </p>
  </div>
</template>
