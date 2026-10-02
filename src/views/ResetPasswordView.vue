<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'
import Icon from '@/components/Icon.vue'
import PasswordField from '@/components/PasswordField.vue'
import PasswordStrength from '@/components/PasswordStrength.vue'
import { ApiError, authApi } from '@/lib/api'
import { describeError } from '@/lib/errors'
import { passwordAcceptable } from '@/lib/password'

const route = useRoute()
const token = typeof route.query.token === 'string' ? route.query.token : ''
const state = ref<'form' | 'success' | 'invalid'>(token ? 'form' : 'invalid')
const password = ref('')
const saving = ref(false)
const error = ref('')
const fieldErrors = ref<string[]>([])
const canSubmit = computed(() => passwordAcceptable(password.value))

async function submit() {
  error.value = ''
  fieldErrors.value = []
  saving.value = true
  try {
    await authApi.resetPassword(token, password.value)
    state.value = 'success'
  } catch (e) {
    if (e instanceof ApiError && e.status === 400) {
      const passwordErrors = e.fieldErrors.password
      if (passwordErrors?.length) fieldErrors.value = passwordErrors
      else state.value = 'invalid'
    } else {
      error.value = describeError(e)
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="card p-6 sm:p-8">
    <template v-if="state === 'form'">
      <div class="text-center">
        <span class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed-variant"><Icon name="key" fill :size="24" /></span>
        <h1 class="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p class="mt-1 text-on-surface-variant">You'll be signed out everywhere else.</p>
      </div>
      <form class="mt-7 space-y-4" novalidate @submit.prevent="submit">
        <div>
          <PasswordField id="new-password" v-model="password" label="New password" autocomplete="new-password" :invalid="fieldErrors.length > 0" />
          <PasswordStrength :password="password" />
          <p v-for="msg in fieldErrors" :key="msg" class="mt-1 text-[13px] text-error">{{ msg }}</p>
        </div>
        <p v-if="error" class="flex items-start gap-2 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
          <Icon name="error" fill :size="18" class="mt-px" />{{ error }}
        </p>
        <BaseButton type="submit" size="lg" block :loading="saving" :disabled="!canSubmit" icon-right="arrow_forward">Save new password</BaseButton>
      </form>
    </template>

    <template v-else-if="state === 'success'">
      <div class="text-center">
        <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed-variant"><Icon name="verified" fill :size="28" /></span>
        <h1 class="text-2xl font-semibold tracking-tight">Password updated</h1>
        <p class="mt-2 text-on-surface-variant">Log in with your new password.</p>
        <BaseButton class="mt-6" :to="{ name: 'login' }" size="lg" block icon-right="arrow_forward">Log in</BaseButton>
      </div>
    </template>

    <template v-else>
      <div class="text-center">
        <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-on-error-container"><Icon name="link_off" :size="28" /></span>
        <h1 class="text-2xl font-semibold tracking-tight">This link didn't work</h1>
        <p class="mt-2 text-on-surface-variant">It may have expired or been used already.</p>
        <BaseButton class="mt-6" :to="{ name: 'forgot-password' }" block icon="mail">Send a new reset link</BaseButton>
        <p class="mt-4 text-sm"><RouterLink :to="{ name: 'login' }" class="font-medium text-primary hover:underline">Back to log in</RouterLink></p>
      </div>
    </template>
  </div>
</template>
