<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'
import Icon from '@/components/Icon.vue'
import { ApiError, authApi } from '@/lib/api'
import { describeError } from '@/lib/errors'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
const toast = useToastStore()
const state = ref<'verifying' | 'success' | 'invalid' | 'error'>('verifying')
const message = ref('')
const email = ref('')
const resending = ref(false)

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : ''
  if (!token) {
    state.value = 'invalid'
    return
  }
  try {
    await authApi.verifyEmail(token)
    state.value = 'success'
  } catch (e) {
    if (e instanceof ApiError && e.status === 400) state.value = 'invalid'
    else {
      state.value = 'error'
      message.value = describeError(e)
    }
  }
})

function reload() {
  window.location.reload()
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
  <div class="card p-6 text-center sm:p-8">
    <template v-if="state === 'verifying'">
      <div class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary-fixed border-t-primary" />
      <h1 class="text-xl font-semibold">Confirming your email…</h1>
    </template>

    <template v-else-if="state === 'success'">
      <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed-variant"><Icon name="verified" fill :size="28" /></span>
      <h1 class="text-2xl font-semibold tracking-tight">Email confirmed</h1>
      <p class="mt-2 text-on-surface-variant">Your account is ready. Log in to send your first file.</p>
      <BaseButton class="mt-6" :to="{ name: 'login' }" size="lg" block icon-right="arrow_forward">Log in</BaseButton>
    </template>

    <template v-else-if="state === 'invalid'">
      <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-on-error-container"><Icon name="link_off" :size="28" /></span>
      <h1 class="text-2xl font-semibold tracking-tight">This link didn't work</h1>
      <p class="mt-2 text-on-surface-variant">It may have expired or been used already. Enter your email and we'll send a fresh one.</p>
      <form class="mt-6 space-y-3 text-left" @submit.prevent="resend">
        <label for="email" class="label">Email address</label>
        <input id="email" v-model="email" type="email" class="field" placeholder="you@example.com" autocomplete="email" required />
        <BaseButton type="submit" block :loading="resending" :disabled="!email.includes('@')" icon="mail">Send a new link</BaseButton>
      </form>
      <BaseButton class="mt-3" :to="{ name: 'login' }" variant="ghost" block>Back to log in</BaseButton>
    </template>

    <template v-else>
      <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-on-error-container"><Icon name="cloud_off" :size="28" /></span>
      <h1 class="text-2xl font-semibold tracking-tight">Couldn't confirm right now</h1>
      <p class="mt-2 text-on-surface-variant">{{ message }}</p>
      <BaseButton class="mt-6" block variant="secondary" icon="refresh" @click="reload">Try again</BaseButton>
    </template>
  </div>
</template>
