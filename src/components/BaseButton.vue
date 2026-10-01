<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import Icon from './Icon.vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'danger-soft'
    size?: 'sm' | 'md' | 'lg'
    to?: RouteLocationRaw
    href?: string
    type?: 'button' | 'submit'
    loading?: boolean
    disabled?: boolean
    block?: boolean
    icon?: string
    iconRight?: string
  }>(),
  { variant: 'primary', size: 'md', type: 'button' },
)

const classes = computed(() => [
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all',
  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  props.block ? 'w-full' : '',
  { sm: 'px-3 py-1.5 text-[13px]', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3.5 text-[15px]' }[props.size],
  {
    primary: 'bg-primary text-on-primary shadow-sm hover:brightness-110',
    secondary: 'border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low',
    soft: 'bg-surface-container text-on-surface hover:bg-surface-container-high',
    ghost: 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
    danger: 'bg-error text-on-error hover:brightness-110',
    'danger-soft': 'bg-error-container text-on-error-container hover:brightness-95',
  }[props.variant],
])
</script>

<template>
  <RouterLink v-if="to && !disabled" :to="to" :class="classes">
    <Icon v-if="icon" :name="icon" :size="18" />
    <slot />
    <Icon v-if="iconRight" :name="iconRight" :size="18" />
  </RouterLink>
  <a v-else-if="href && !disabled" :href="href" :class="classes" target="_blank" rel="noopener noreferrer">
    <Icon v-if="icon" :name="icon" :size="18" />
    <slot />
    <Icon v-if="iconRight" :name="iconRight" :size="18" />
  </a>
  <button v-else :type="type" :class="classes" :disabled="disabled || loading" :aria-busy="loading">
    <span v-if="loading" class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    <Icon v-else-if="icon" :name="icon" :size="18" />
    <slot />
    <Icon v-if="iconRight && !loading" :name="iconRight" :size="18" />
  </button>
</template>
