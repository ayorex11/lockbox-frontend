<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import BaseButton from '@/components/BaseButton.vue'
import Icon from '@/components/Icon.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const menuOpen = ref(false)
const menu = ref<HTMLElement | null>(null)

function onDocClick(event: MouseEvent) {
  if (menu.value && !menu.value.contains(event.target as Node)) menuOpen.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

async function logout() {
  menuOpen.value = false
  await auth.logout()
  await router.replace({ name: 'landing' })
}
const linkClass = 'rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-30 border-b border-outline-variant/40 bg-background/85 backdrop-blur">
      <div class="container-page flex h-16 items-center justify-between gap-4">
        <div class="flex items-center gap-6">
          <AppLogo :to="'/dashboard'" />
          <nav class="hidden items-center gap-1 sm:flex" aria-label="App">
            <RouterLink :to="{ name: 'dashboard' }" :class="linkClass" active-class="!bg-surface-container !text-on-surface">My files</RouterLink>
            <RouterLink :to="{ name: 'send' }" :class="linkClass" active-class="!bg-surface-container !text-on-surface">Send a file</RouterLink>
          </nav>
        </div>
        <div class="flex items-center gap-2">
          <ThemeToggle />
          <BaseButton :to="{ name: 'send' }" icon="add" class="hidden sm:inline-flex">Send a file</BaseButton>
          <div ref="menu" class="relative">
            <button
              type="button"
              class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-sm font-semibold text-on-primary-container"
              aria-haspopup="menu"
              :aria-expanded="menuOpen"
              aria-label="Account menu"
              @click.stop="menuOpen = !menuOpen"
            >
              {{ (auth.email ?? '?').charAt(0).toUpperCase() }}
            </button>
            <div v-if="menuOpen" role="menu" class="card absolute right-0 top-12 w-64 p-2 shadow-pop">
              <p class="truncate px-3 py-2 text-sm text-on-surface-variant">{{ auth.email }}</p>
              <RouterLink :to="{ name: 'dashboard' }" role="menuitem" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-container sm:hidden" @click="menuOpen = false">
                <Icon name="folder" :size="18" /> My files
              </RouterLink>
              <RouterLink :to="{ name: 'send' }" role="menuitem" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-container sm:hidden" @click="menuOpen = false">
                <Icon name="add" :size="18" /> Send a file
              </RouterLink>
              <button type="button" role="menuitem" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-error hover:bg-error-container" @click="logout">
                <Icon name="logout" :size="18" /> Log out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="container-page flex-1 py-8 sm:py-10"><RouterView /></main>

    <footer class="border-t border-outline-variant/40 py-5 text-center text-xs text-on-surface-variant">
      Locked in your browser before upload · © {{ new Date().getFullYear() }} Lockbox
    </footer>
  </div>
</template>
