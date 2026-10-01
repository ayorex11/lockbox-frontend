<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'
import Icon from '@/components/Icon.vue'
import { authApi } from '@/lib/api'
import { describeError } from '@/lib/errors'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
const toast = useToastStore()
const email = computed(() => (typeof route.query.email === 'string' ? route.query.email : ''))

const cooldown = ref(30)
const sending = ref(false)
const timer = setInterval(() => { if (cooldown.value > 0) cooldown.value -= 1 }, 1000)
onBeforeUnmount(() => clearInterval(timer))

async function resend() {
  sending.value = true
  try {
    await authApi.resendVerification(email.value)
    toast.success('A new link is on its way.')
    cooldown.value = 60
  } catch (e) {
    toast.error(describeError(e))
  } finally {
    sending.value = false
  }
}
function openMailApp() {
  window.location.href = 'mailto:'
}
const steps = [
  'Open the email from Lockbox',
  'Click “Confirm your email”',
  'Log in and send your first file',
]
</script>

<template>
  <div class="card p-6 text-center sm:p-8">
    <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container"><Icon name="mark_email_unread" :size="28" /></span>
    <h1 class="text-2xl font-semibold tracking-tight">Check your inbox</h1>
    <p class="mt-2 text-on-surface-variant">
      We sent a confirmation link to
      <strong v-if="email" class="break-all text-on-surface">{{ email }}</strong>
      <template v-else>your email address</template>. It expires in 48 hours.
    </p>

    <ol class="mt-6 space-y-2 rounded-xl bg-surface-container-low p-4 text-left text-sm">
      <li v-for="(step, i) in steps" :key="step" class="flex items-center gap-3">
        <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-semibold text-on-primary-container">{{ i + 1 }}</span>
        {{ step }}
      </li>
    </ol>

    <div class="mt-6 space-y-2">
      <BaseButton variant="primary" block size="lg" icon="mail" @click="openMailApp">Open email app</BaseButton>
      <BaseButton variant="secondary" block :loading="sending" :disabled="!email || cooldown > 0" icon="refresh" @click="resend">
        {{ cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email' }}
      </BaseButton>
    </div>

    <p class="mt-5 text-sm text-on-surface-variant">
      Wrong address? <RouterLink :to="{ name: 'signup' }" class="font-medium text-primary hover:underline">Change email</RouterLink>
      · <RouterLink :to="{ name: 'login', query: email ? { email } : {} }" class="font-medium text-primary hover:underline">Back to log in</RouterLink>
    </p>
    <p class="hint mt-4">Can't see it? Check your spam folder.</p>
  </div>
</template>
