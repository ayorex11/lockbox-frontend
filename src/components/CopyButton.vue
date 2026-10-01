<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { copyText } from '@/lib/clipboard'
import { useToastStore } from '@/stores/toast'
import BaseButton from './BaseButton.vue'

const props = withDefaults(
  defineProps<{
    text: string | null
    variant?: 'primary' | 'secondary' | 'soft' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    label?: string
    iconOnly?: boolean
    disabledHint?: string
  }>(),
  { variant: 'secondary', size: 'md', label: 'Copy link' },
)

const toast = useToastStore()
const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  if (!props.text) return
  if (await copyText(props.text)) {
    copied.value = true
    toast.success('Link copied. Share it only with people you trust.')
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), 2000)
  } else {
    toast.error('Could not copy. Select the link and copy it manually.')
  }
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <BaseButton
    :variant="variant"
    :size="size"
    :icon="copied ? 'check' : 'content_copy'"
    :disabled="!text"
    :title="!text ? disabledHint : undefined"
    :aria-label="iconOnly ? label : undefined"
    @click="copy"
  >
    <template v-if="!iconOnly">{{ copied ? 'Copied' : label }}</template>
  </BaseButton>
</template>
