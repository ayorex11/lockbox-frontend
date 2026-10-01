<script setup lang="ts">
import BaseButton from '@/components/BaseButton.vue'
import Icon from '@/components/Icon.vue'
</script>

<template>
  <div class="card p-8 text-center">
    <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
      <Icon name="explore_off" :size="28" />
    </span>
    <h1 class="text-2xl font-semibold">Page not found</h1>
    <p class="mt-2 text-on-surface-variant">That page doesn't exist. If you were given a private link, check that you copied all of it.</p>
    <BaseButton class="mt-6" :to="{ name: 'landing' }" block>Back to Lockbox</BaseButton>
  </div>
</template>
