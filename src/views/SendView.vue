<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'
import DropZone from '@/components/DropZone.vue'
import Icon from '@/components/Icon.vue'
import PasswordField from '@/components/PasswordField.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import ToggleSwitch from '@/components/ToggleSwitch.vue'
import { ApiError, NetworkError, type LinkMode, type TtlChoice } from '@/lib/api'
import { MAX_FILE_BYTES } from '@/lib/crypto'
import { describeError } from '@/lib/errors'
import { fileIcon, formatBytes } from '@/lib/format'
import { sendFile, type SendStage, type SendState } from '@/lib/sendPipeline'
import { UploadError } from '@/lib/upload'
import { useKeyStore } from '@/stores/keys'
import { usePendingFileStore } from '@/stores/pending'

type Phase = 'choose' | 'configure' | 'working' | 'failed'

const router = useRouter()
const keys = useKeyStore()
const pending = usePendingFileStore()

const phase = ref<Phase>('choose')
const file = ref<File | null>(null)
const fileError = ref('')
const stage = ref<SendStage>('locking')
const uploadProgress = ref(0)
const failure = ref('')
let resumeState: SendState = {}

const options = reactive({
  mode: 'timed' as LinkMode,
  ttl: '24h' as TtlChoice,
  maxDownloads: 0, // 0 = no limit
  usePassword: false,
  password: '',
  showSenderEmail: true,
})

const modeOptions = [
  { value: 'timed' as const, label: 'Expires after a time', icon: 'schedule' },
  { value: 'one_time' as const, label: 'Self-destruct after first download', icon: 'local_fire_department' },
]
const ttlOptions: { value: TtlChoice; label: string }[] = [
  { value: '1h', label: '1 hour' }, { value: '24h', label: '24 hours' }, { value: '7d', label: '7 days' },
]
const downloadCaps = [0, 1, 3, 5, 10, 25, 50]

const passwordTooShort = computed(() => options.usePassword && options.password.length > 0 && options.password.length < LINK_PASSWORD_MIN)
const canCreate = computed(() => !!file.value && (!options.usePassword || options.password.length >= LINK_PASSWORD_MIN))

function choose(picked: File) {
  fileError.value = ''
  if (picked.size === 0) { fileError.value = 'That file is empty.'; return }
  if (picked.size > MAX_FILE_BYTES) {
    fileError.value = `That file is ${formatBytes(picked.size)}. Files can be up to 25 MB.`
    return
  }
  file.value = picked
  resumeState = {}
  phase.value = 'configure'
}

onMounted(() => {
  const handedOver = pending.take()
  if (handedOver) choose(handedOver)
})

const stages: { id: SendStage; label: string; detail: string }[] = [
  { id: 'locking', label: 'Locking your file', detail: 'Encrypting in this browser' },
  { id: 'uploading', label: 'Uploading the locked file', detail: 'Only scrambled data leaves your device' },
  { id: 'creating', label: 'Creating your private link', detail: 'Almost there' },
]
const stageIndex = computed(() => ({ locking: 0, uploading: 1, finishing: 1, creating: 2 }[stage.value]))
const overall = computed(() => {
  switch (stage.value) {
    case 'locking': return 0.06
    case 'uploading': return 0.1 + uploadProgress.value * 0.75
    case 'finishing': return 0.88
    default: return 0.95
  }
})

const LINK_PASSWORD_MIN = 8

function explain(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'file_limit_reached') return "You have too many active files. Revoke a link you no longer need, or wait for some to expire."
    const passwordCode = error.fieldErrors.password?.[0]
    if (passwordCode === 'password_too_common') return 'That link password is too easy to guess. Go back to options and choose a longer or less common one.'
    if (passwordCode === 'password_too_short') return 'Use at least 8 characters for the link password.'
    const first = Object.values(error.fieldErrors)[0]?.[0]
    if (error.status === 400 && first) return `The server rejected the request (${first.replaceAll('_', ' ')}).`
  }
  if (error instanceof UploadError) return "The upload didn't finish. Check your connection and try again."
  if (error instanceof NetworkError) return describeError(error)
  return describeError(error)
}

async function create() {
  if (!file.value) return
  phase.value = 'working'
  failure.value = ''
  uploadProgress.value = 0
  try {
    const { link, key } = await sendFile(
      file.value,
      {
        mode: options.mode,
        ttl: options.ttl,
        maxDownloads: options.maxDownloads || null,
        password: options.usePassword ? options.password : null,
        showSenderEmail: options.showSenderEmail,
      },
      { onStage: (s) => (stage.value = s), onProgress: (f) => (uploadProgress.value = f) },
      resumeState,
    )
    keys.save(link.id, key, link.expires_at)
    resumeState = {}
    await router.replace({ name: 'link-ready', params: { id: link.id } })
  } catch (e) {
    failure.value = explain(e)
    phase.value = 'failed'
  }
}

function reset() {
  file.value = null
  resumeState = {}
  fileError.value = ''
  phase.value = 'choose'
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="text-center">
      <span class="inline-flex items-center gap-2 rounded-full bg-primary-fixed px-3 py-1 text-xs font-medium text-on-primary-fixed-variant">
        <Icon name="shield_lock" fill :size="14" /> End-to-end encrypted contents
      </span>
      <h1 class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Send a file privately</h1>
      <p class="mx-auto mt-2 max-w-md text-on-surface-variant">Your file is locked in this browser before it's uploaded. Not even Lockbox can read what's inside.</p>
    </div>

    <!-- 1. choose -->
    <div v-if="phase === 'choose'" class="card mt-8 p-3">
      <DropZone @select="choose" />
      <p v-if="fileError" class="flex items-center gap-2 px-3 py-3 text-sm text-error" role="alert"><Icon name="error" fill :size="18" />{{ fileError }}</p>
    </div>

    <!-- 2. configure -->
    <form v-else-if="phase === 'configure' && file" class="card mt-8 space-y-6 p-5 sm:p-7" @submit.prevent="create">
      <div class="flex items-center gap-3 rounded-xl bg-surface-container-low p-4">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest text-primary shadow-sm"><Icon :name="fileIcon(file.name)" :size="24" /></span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium">{{ file.name }}</p>
          <p class="hint">{{ formatBytes(file.size) }} · ready to lock</p>
        </div>
        <BaseButton variant="ghost" size="sm" @click="reset">Change file</BaseButton>
      </div>

      <div>
        <h2 class="mb-3 text-base font-semibold">Link options</h2>
        <SegmentedControl v-model="options.mode" :options="modeOptions" label="Link type" />
        <p class="hint mt-2">
          <template v-if="options.mode === 'timed'">The link works until the time runs out (or the download limit is reached).</template>
          <template v-else>The file is deleted the moment it's downloaded once. If nobody opens it, the link still expires after the time below.</template>
        </p>
      </div>

      <div>
        <p class="label">{{ options.mode === 'timed' ? 'Expires after' : 'If unopened, expire after' }}</p>
        <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Expiry">
          <button
            v-for="t in ttlOptions"
            :key="t.value"
            type="button"
            role="radio"
            :aria-checked="options.ttl === t.value"
            class="rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
            :class="options.ttl === t.value ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'"
            @click="options.ttl = t.value"
          >{{ t.label }}</button>
        </div>
      </div>

      <div v-if="options.mode === 'timed'">
        <label for="cap" class="label">Limit downloads <span class="font-normal text-on-surface-variant">(optional)</span></label>
        <select id="cap" v-model.number="options.maxDownloads" class="field">
          <option v-for="n in downloadCaps" :key="n" :value="n">{{ n === 0 ? 'No download limit' : `${n} download${n > 1 ? 's' : ''}` }}</option>
        </select>
      </div>

      <div class="space-y-3">
        <ToggleSwitch v-model="options.usePassword" icon="key" label="Add a password" description="The recipient must enter it before they can download." />
        <div v-if="options.usePassword">
          <PasswordField id="link-password" v-model="options.password" placeholder="At least 8 characters" autocomplete="off" :invalid="passwordTooShort" />
          <p v-if="passwordTooShort" class="mt-1 text-[13px] text-error">Use at least 8 characters.</p>
          <p class="hint mt-1.5">Share the password separately from the link. After 5 wrong tries the link locks for 15 minutes, and after 3 lockouts it is deleted. Avoid common passwords.</p>
        </div>
        <ToggleSwitch v-model="options.showSenderEmail" icon="badge" label="Show my email to the recipient" description="They'll see who sent the file. Turn off to stay anonymous." />
      </div>

      <BaseButton type="submit" size="lg" block icon="lock" :disabled="!canCreate">Create private link</BaseButton>
      <p class="hint text-center">AES-256 encryption · The key stays in your link and never reaches our servers</p>
    </form>

    <!-- 3. working -->
    <div v-else-if="phase === 'working' && file" class="card mt-8 p-6 sm:p-8" aria-live="polite">
      <div class="flex items-center gap-3">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-on-primary-fixed-variant"><Icon :name="fileIcon(file.name)" :size="24" /></span>
        <div class="min-w-0"><p class="truncate font-medium">{{ file.name }}</p><p class="hint">{{ formatBytes(file.size) }}</p></div>
      </div>
      <div class="mt-6"><ProgressBar :value="overall" label="Progress" /></div>
      <ol class="mt-6 space-y-4">
        <li v-for="(s, i) in stages" :key="s.id" class="flex items-start gap-3" :class="i > stageIndex ? 'opacity-50' : ''">
          <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
            <Icon v-if="i < stageIndex" name="check_circle" fill class="text-primary" />
            <span v-else-if="i === stageIndex" class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <Icon v-else name="radio_button_unchecked" class="text-outline" />
          </span>
          <div>
            <p class="text-[15px] font-medium">{{ s.label }}<span v-if="i === 1 && stageIndex === 1" class="ml-2 font-mono text-sm text-primary">{{ Math.round(uploadProgress * 100) }}%</span></p>
            <p class="hint">{{ s.detail }}</p>
          </div>
        </li>
      </ol>
      <p class="hint mt-6 flex items-center gap-1.5"><Icon name="info" :size="15" /> Keep this tab open until it finishes.</p>
    </div>

    <!-- 4. failed -->
    <div v-else-if="phase === 'failed'" class="card mt-8 p-6 text-center sm:p-8" role="alert">
      <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-on-error-container"><Icon name="error" fill :size="28" /></span>
      <h2 class="text-xl font-semibold">That didn't go through</h2>
      <p class="mx-auto mt-2 max-w-md text-on-surface-variant">{{ failure }}</p>
      <div class="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <BaseButton icon="refresh" @click="create">Try again</BaseButton>
        <BaseButton variant="secondary" @click="phase = 'configure'">Back to options</BaseButton>
      </div>
    </div>
  </div>
</template>
