<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'
import Icon from '@/components/Icon.vue'
import { authApi } from '@/lib/api'
import { describeError } from '@/lib/errors'

const email = ref('')
const loading = ref(false)
const error = ref('')
const sent = ref(false)
const canSubmit = computed(() => email.value.includes('@'))

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await authApi.forgotPassword(email.value.trim())
    sent.value = true
  } catch (e) {
    error.value = describeError(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="card p-6 sm:p-8">
    <template v-if="!sent">
      <div class="text-center">
        <span class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed-variant"><Icon name="key" fill :size="24" /></span>
        <h1 class="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p class="mt-1 text-on-surface-variant">Enter your email and we'll send you a link to choose a new one.</p>
      </div>
      <form class="mt-7 space-y-4" novalidate @submit.prevent="submit">
        <div>
          <label for="email" class="label">Email address</label>
          <input id="email" v-model="email" type="email" class="field" placeholder="you@example.com" autocomplete="email" required />
        </div>
        <p v-if="error" class="flex items-start gap-2 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
          <Icon name="error" fill :size="18" class="mt-px" />{{ error }}
        </p>
        <BaseButton type="submit" size="lg" block :loading="loading" :disabled="!canSubmit" icon="mail">Send reset link</BaseButton>
      </form>
    </template>

    <template v-else>
      <div class="text-center">
        <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container"><Icon name="mark_email_unread" :size="28" /></span>
        <h1 class="text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p class="mt-2 text-on-surface-variant">If an account exists for <strong class="break-all text-on-surface">{{ email }}</strong>, a reset link is on its way. It works once and expires in an hour.</p>
        <p class="hint mt-4">Can't see it? Check your spam folder.</p>
      </div>
    </template>

    <p class="mt-5 text-center text-sm text-on-surface-variant">
      <RouterLink :to="{ name: 'login' }" class="font-medium text-primary hover:underline">Back to log in</RouterLink>
    </p>
  </div>
</template>
