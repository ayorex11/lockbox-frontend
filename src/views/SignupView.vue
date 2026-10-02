<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'
import Icon from '@/components/Icon.vue'
import { ApiError, authApi } from '@/lib/api'
import { describeError } from '@/lib/errors'

const router = useRouter()
const email = ref('')
const loading = ref(false)
const error = ref('')
const fieldErrors = ref<Record<string, string[]>>({})

const canSubmit = computed(() => email.value.includes('@'))

async function submit() {
  error.value = ''
  fieldErrors.value = {}
  loading.value = true
  try {
    const address = email.value.trim()
    await authApi.register(address)
    await router.push({ name: 'check-email', query: { email: address } })
  } catch (e) {
    if (e instanceof ApiError && e.status === 400) {
      fieldErrors.value = e.fieldErrors
      if (!Object.keys(fieldErrors.value).length) error.value = 'Please check the details and try again.'
    } else {
      error.value = describeError(e)
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="card p-6 sm:p-8">
    <div class="text-center">
      <span class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed-variant"><Icon name="lock" fill :size="24" /></span>
      <h1 class="text-2xl font-semibold tracking-tight">Create your Lockbox account</h1>
      <p class="mt-1 text-on-surface-variant">Start sending files with end-to-end encryption.</p>
    </div>

    <form class="mt-7 space-y-4" novalidate @submit.prevent="submit">
      <div>
        <label for="email" class="label">Email address</label>
        <input id="email" v-model="email" type="email" class="field" :class="fieldErrors.email ? 'border-error' : ''" placeholder="you@example.com" autocomplete="email" required />
        <p v-for="msg in fieldErrors.email" :key="msg" class="mt-1 text-[13px] text-error">Enter a valid email address.</p>
        <p class="hint mt-1.5">We'll email you a link to confirm it and choose your password.</p>
      </div>

      <p v-if="error" class="flex items-start gap-2 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
        <Icon name="error" fill :size="18" class="mt-px" />{{ error }}
      </p>

      <BaseButton type="submit" size="lg" block :loading="loading" :disabled="!canSubmit" icon-right="arrow_forward">Continue</BaseButton>
    </form>

    <p class="hint mt-4 flex items-center justify-center gap-1.5"><Icon name="shield_lock" :size="15" /> We never see what's inside your files.</p>
    <p class="mt-5 text-center text-sm text-on-surface-variant">
      Already have an account? <RouterLink :to="{ name: 'login' }" class="font-medium text-primary hover:underline">Log in</RouterLink>
    </p>
  </div>
</template>
