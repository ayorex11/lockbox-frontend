<script setup lang="ts">
import { computed } from 'vue'
import type { LinkStatus } from '@/lib/api'
import Icon from './Icon.vue'

const props = defineProps<{ status: LinkStatus }>()

const meta = computed(() => ({
  active: { label: 'Active', icon: 'check_circle', cls: 'bg-primary-fixed text-on-primary-fixed-variant' },
  used: { label: 'Used', icon: 'task_alt', cls: 'bg-tertiary-container text-on-tertiary-container' },
  expired: { label: 'Expired', icon: 'schedule', cls: 'bg-surface-container-high text-on-surface-variant' },
  revoked: { label: 'Revoked', icon: 'block', cls: 'bg-error-container text-on-error-container' },
}[props.status]))
</script>

<template>
  <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium" :class="meta.cls">
    <Icon :name="meta.icon" fill :size="14" />{{ meta.label }}
  </span>
</template>
