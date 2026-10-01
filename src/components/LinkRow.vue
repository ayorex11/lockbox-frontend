<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { ShareLink } from '@/lib/api'
import { fileIcon, formatBytes, formatCreated, timeLeft } from '@/lib/format'
import BaseButton from './BaseButton.vue'
import CopyButton from './CopyButton.vue'
import Icon from './Icon.vue'
import StatusBadge from './StatusBadge.vue'

const props = defineProps<{ link: ShareLink; shareUrl: string | null; now: number }>()
const emit = defineEmits<{ revoke: [link: ShareLink] }>()

const traits = computed(() => {
  const out: { icon: string; text: string }[] = []
  if (props.link.mode === 'one_time') out.push({ icon: 'local_fire_department', text: 'Self-destructs after 1 download' })
  if (props.link.requires_password) out.push({ icon: 'key', text: 'Password protected' })
  if (props.link.mode === 'timed' && props.link.max_downloads) out.push({ icon: 'download', text: `Max ${props.link.max_downloads} downloads` })
  return out
})

const statusNote = computed(() => {
  switch (props.link.status) {
    case 'active': return `Expires in ${timeLeft(props.link.expires_at, props.now)}`
    case 'used': return 'File deleted after use'
    case 'expired': return 'Time limit passed'
    default: return 'File deleted by you'
  }
})

const downloads = computed(() => {
  const { mode, max_downloads: max, download_count: n } = props.link
  if (mode === 'one_time') return `${n} / 1`
  return max ? `${n} / ${max}` : String(n)
})
</script>

<template>
  <div class="grid items-center gap-3 px-5 py-4 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] md:gap-4">
    <div class="flex min-w-0 items-center gap-3">
      <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
        <Icon :name="fileIcon(link.file_name)" />
      </span>
      <div class="min-w-0">
        <RouterLink :to="{ name: 'link-activity', params: { id: link.id } }" class="block truncate font-medium hover:text-primary hover:underline">
          {{ link.file_name }}
        </RouterLink>
        <p class="hint truncate">
          {{ formatBytes(link.file_size) }}
          <template v-for="trait in traits" :key="trait.text">
            · <Icon :name="trait.icon" :size="13" class="align-[-2px]" /> {{ trait.text }}
          </template>
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2 md:block">
      <StatusBadge :status="link.status" />
      <p class="hint md:mt-1">{{ statusNote }}</p>
    </div>

    <p class="hint md:text-[14px] md:text-on-surface"><span class="md:hidden">Created: </span>{{ formatCreated(link.created_at) }}</p>
    <p class="text-sm md:font-medium"><span class="hint md:hidden">Downloads: </span>{{ downloads }}</p>

    <div class="flex items-center gap-1 md:justify-end">
      <CopyButton
        v-if="link.status === 'active'"
        :text="shareUrl"
        variant="ghost"
        size="sm"
        icon-only
        label="Copy link"
        disabled-hint="The key for this link is only kept on the device that created it."
      />
      <BaseButton :to="{ name: 'link-activity', params: { id: link.id } }" variant="ghost" size="sm" icon="history" aria-label="View activity" title="View activity" />
      <BaseButton
        v-if="link.status === 'active'"
        variant="ghost"
        size="sm"
        icon="block"
        class="!text-error hover:!bg-error-container"
        aria-label="Revoke link"
        title="Revoke link"
        @click="emit('revoke', link)"
      />
    </div>
  </div>
</template>
