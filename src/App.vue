<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import ToastHost from '@/components/ToastHost.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
// Restore the session in the background so headers on public pages know if you're signed in.
onMounted(() => { void auth.bootstrap() })
</script>

<template>
  <RouterView />
  <ToastHost />
</template>
