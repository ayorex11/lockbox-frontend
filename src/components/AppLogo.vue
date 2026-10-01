<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Icon from './Icon.vue'

defineProps<{ to?: string }>()
</script>

<template>
  <RouterLink :to="to ?? '/'" class="inline-flex items-center gap-2.5 rounded-lg" aria-label="Lockbox home">
    <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
      <Icon name="lock" fill :size="20" />
    </span>
    <span class="text-lg font-semibold tracking-tight text-on-surface">Lockbox</span>
  </RouterLink>
</template>
