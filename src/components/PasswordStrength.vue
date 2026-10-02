<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import { passwordChecks, passwordScore, strengthLabel } from '@/lib/password'

const props = defineProps<{ password: string }>()
const checks = computed(() => passwordChecks(props.password))
const score = computed(() => passwordScore(props.password))
</script>

<template>
  <div v-if="password" class="mt-3 rounded-xl bg-surface-container-low p-3">
    <div class="flex items-center justify-between text-xs">
      <span class="font-medium text-on-surface-variant">Password strength</span>
      <span class="font-mono" :class="score >= 3 ? 'text-primary' : 'text-on-surface-variant'">{{ strengthLabel(score) }}</span>
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
</template>
