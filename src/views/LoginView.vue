<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'
import Icon from '@/components/Icon.vue'
import PasswordField from '@/components/PasswordField.vue'
import { ApiError, authApi } from '@/lib/api'
import { describeError } from '@/lib/errors'
import { formatClock } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const toast = useToastStore()

const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const password = ref('')
const loading = ref(false)
const error = ref('')
const unverified = ref(false)
const lockedFor = ref(0)
const resending = ref(false)
let lockTimer: ReturnType<typeof setInterval> | undefined

const lockMessage = computed(() => (lockedFor.value > 0 ? `Too many attempts. Try again in ${formatClock(lockedFor.value)}.` : ''))

function startLock(seconds: number) {
  lockedFor.value = seconds
  clearInterval(lockTimer)
  lockTimer = setInterval(() => {
    lockedFor.value -= 1
    if (lockedFor.value <= 0) clearInterval(lockTimer)
  }, 1000)
}
onBeforeUnmount(() => clearInterval(lockTimer))

function safeRedirect(): string {
  const target = route.query.redirect
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : auth.isStaff ? '/admin' : '/dashboard'
}

async function submit() {
  error.value = ''
  unverified.value = false
  loading.value = true
  try {
    await auth.login(email.value.trim(), password.value)
    await router.replace(safeRedirect())
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) error.value = 'Email or password is incorrect.'
    else if (e instanceof ApiError && e.status === 423) startLock(Number(e.data.retry_after ?? 900))
    else if (e instanceof ApiError && e.code === 'email_not_verified') unverified.value = true
    else error.value = describeError(e)
  } finally {
    loading.value = false
  }
}

async function resend() {
  resending.value = true
  try {
    await authApi.resendVerification(email.value.trim())
    toast.success('If that account needs verifying, a new link is on its way.')
  } catch (e) {
    toast.error(describeError(e))
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <div class="card p-6 sm:p-8">
    <div class="text-center">
      <span class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed-variant"><Icon name="lock_open" :size="24" /></span>
      <h1 class="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p class="mt-1 text-on-surface-variant">Log in to send files and manage your links.</p>
    </div>

    <form class="mt-7 space-y-4" novalidate @submit.prevent="submit">
      <div>
        <label for="email" class="label">Email address</label>
        <input id="email" v-model="email" type="email" class="field" placeholder="you@example.com" autocomplete="email" required />
      </div>
      <PasswordField id="password" v-model="password" label="Password" autocomplete="current-password" />

      <p v-if="error" class="flex items-start gap-2 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
        <Icon name="error" fill :size="18" class="mt-px" />{{ error }}
      </p>
      <p v-if="lockMessage" class="flex items-start gap-2 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
        <Icon name="lock_clock" fill :size="18" class="mt-px" />{{ lockMessage }}
      </p>
      <div v-if="unverified" class="rounded-xl bg-tertiary-container px-4 py-3 text-sm text-on-tertiary-container" role="alert">
        <p class="font-medium">Confirm your email first</p>
        <p class="mt-0.5">We sent a link when you signed up. Can't find it?</p>
        <BaseButton class="mt-2" size="sm" variant="secondary" :loading="resending" @click="resend">Send a new link</BaseButton>
      </div>

      <BaseButton type="submit" size="lg" block :loading="loading" :disabled="!email || !password || lockedFor > 0" icon-right="arrow_forward">Log in</BaseButton>
    </form>

    <p class="mt-6 text-center text-sm text-on-surface-variant">
      New to Lockbox? <RouterLink :to="{ name: 'signup' }" class="font-medium text-primary hover:underline">Create a free account</RouterLink>
    </p>
    <p class="hint mt-4 flex items-center justify-center gap-1.5 text-center"><Icon name="info" :size="15" /> Received a link? Just open it. You don't need an account.</p>
  </div>
</template>
