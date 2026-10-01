<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'
import Icon from '@/components/Icon.vue'
import PasswordField from '@/components/PasswordField.vue'
import { ApiError, authApi } from '@/lib/api'
import { describeError } from '@/lib/errors'

const router = useRouter()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const fieldErrors = ref<Record<string, string[]>>({})

const checks = computed(() => [
  { ok: password.value.length >= 10, text: 'At least 10 characters' },
  { ok: /[A-Za-z]/.test(password.value) && /\d/.test(password.value), text: 'A mix of letters and numbers' },
])
const score = computed(() => {
  const p = password.value
  if (!p) return 0
  let s = 0
  if (p.length >= 10) s++
  if (p.length >= 14) s++
  if (/[A-Za-z]/.test(p) && /\d/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p) || (/[a-z]/.test(p) && /[A-Z]/.test(p))) s++
  return s
})
const strengthLabel = computed(() => ['', 'Weak', 'Okay', 'Good', 'Strong'][score.value] || 'Weak')
const canSubmit = computed(() => email.value.includes('@') && checks.value.every((c) => c.ok))

async function submit() {
  error.value = ''
  fieldErrors.value = {}
  loading.value = true
  try {
    const address = email.value.trim()
    await authApi.register(address, password.value)
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
      </div>

      <div>
        <PasswordField id="password" v-model="password" label="Password" autocomplete="new-password" :invalid="!!fieldErrors.password" />
        <div v-if="password" class="mt-3 rounded-xl bg-surface-container-low p-3">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-on-surface-variant">Password strength</span>
            <span class="font-mono" :class="score >= 3 ? 'text-primary' : 'text-on-surface-variant'">{{ strengthLabel }}</span>
          </div>
          <div class="mt-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
            <span v-for="n in 4" :key="n" class="h-1.5 rounded-full transition-colors" :class="n <= score ? (score >= 3 ? 'bg-primary' : 'bg-tertiary') : 'bg-outline-variant/60'" />
          </div>
          <ul class="mt-3 space-y-1.5 text-[13px]">
            <li v-for="c in checks" :key="c.text" class="flex items-center gap-2" :class="c.ok ? 'text-primary' : 'text-on-surface-variant'">
              <Icon :name="c.ok ? 'check_circle' : 'radio_button_unchecked'" fill :size="16" />{{ c.text }}
            </li>
          </ul>
        </div>
        <p v-for="msg in fieldErrors.password" :key="msg" class="mt-1 text-[13px] text-error">{{ msg }}</p>
      </div>

      <p v-if="error" class="flex items-start gap-2 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
        <Icon name="error" fill :size="18" class="mt-px" />{{ error }}
      </p>

      <BaseButton type="submit" size="lg" block :loading="loading" :disabled="!canSubmit" icon-right="arrow_forward">Create free account</BaseButton>
    </form>

    <p class="hint mt-4 flex items-center justify-center gap-1.5"><Icon name="shield_lock" :size="15" /> We never see what's inside your files.</p>
    <p class="mt-5 text-center text-sm text-on-surface-variant">
      Already have an account? <RouterLink :to="{ name: 'login' }" class="font-medium text-primary hover:underline">Log in</RouterLink>
    </p>
  </div>
</template>
