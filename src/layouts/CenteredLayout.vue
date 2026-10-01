<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

const year = new Date().getFullYear()
</script>

<template>
  <div class="relative flex min-h-screen flex-col items-center px-4 py-8">
    <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgb(var(--c-primary-container)/0.16),transparent_65%)]" />
    <div class="absolute right-4 top-4"><ThemeToggle /></div>
    <div class="relative mb-8"><AppLogo /></div>
    <main class="relative w-full max-w-[460px] flex-1"><RouterView /></main>
    <footer class="relative mt-10 text-center text-xs text-on-surface-variant">
      <p>Locked in your browser before upload</p>
      <p class="mt-1">© {{ year }} Lockbox</p>
    </footer>
  </div>
</template>
