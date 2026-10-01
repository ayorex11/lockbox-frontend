<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import BaseButton from '@/components/BaseButton.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const year = new Date().getFullYear()
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-30 border-b border-outline-variant/40 bg-background/85 backdrop-blur">
      <div class="container-page flex h-16 items-center justify-between gap-4">
        <div class="flex items-center gap-8">
          <AppLogo />
          <nav class="hidden items-center gap-6 text-sm text-on-surface-variant md:flex" aria-label="Main">
            <RouterLink :to="{ name: 'landing', hash: '#how-it-works' }" class="hover:text-on-surface">How it works</RouterLink>
            <RouterLink :to="{ name: 'landing', hash: '#security' }" class="hover:text-on-surface">Security</RouterLink>
            <RouterLink v-if="auth.isAuthenticated" :to="{ name: 'dashboard' }" class="hover:text-on-surface">My files</RouterLink>
          </nav>
        </div>
        <div class="flex items-center gap-2">
          <ThemeToggle />
          <BaseButton v-if="!auth.isAuthenticated" :to="{ name: 'login' }" variant="ghost">Log in</BaseButton>
          <BaseButton :to="{ name: 'send' }" icon="add" class="hidden sm:inline-flex">Send a file</BaseButton>
        </div>
      </div>
    </header>

    <main class="flex-1"><RouterView /></main>

    <footer class="border-t border-outline-variant/40 bg-surface-container-low">
      <div class="container-page flex flex-col items-start justify-between gap-3 py-6 text-sm text-on-surface-variant sm:flex-row sm:items-center">
        <p>Locked in your browser before upload · End-to-end encrypted contents</p>
        <p>© {{ year }} Lockbox</p>
      </div>
    </footer>
  </div>
</template>
