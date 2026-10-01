<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import Icon from './Icon.vue'

const theme = useThemeStore()
</script>

<template>
  <button
    type="button"
    class="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
    :aria-label="theme.dark ? 'Switch to light theme' : 'Switch to dark theme'"
    @click="theme.toggle()"
  >
    <Icon :name="theme.dark ? 'light_mode' : 'dark_mode'" />
  </button>
</template>
