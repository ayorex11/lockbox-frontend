<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseButton from './BaseButton.vue'

const props = defineProps<{ open: boolean; text: string }>()
const emit = defineEmits<{ close: [] }>()
const dataUrl = ref('')

watch(
  () => [props.open, props.text] as const,
  async ([open, text]) => {
    if (!open) return
    const QRCode = (await import('qrcode')).default // loaded only when needed
    dataUrl.value = await QRCode.toDataURL(text, { margin: 1, width: 280, errorCorrectionLevel: 'M' })
  },
  { immediate: true },
)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @mousedown.self="emit('close')" @keydown.esc="emit('close')">
      <div role="dialog" aria-modal="true" aria-label="QR code" class="card w-full max-w-sm p-6 text-center shadow-pop">
        <h2 class="text-lg font-semibold">Scan to open on another device</h2>
        <p class="hint mt-1">This QR code contains the full private link. Only show it to the person you're sharing with.</p>
        <div class="mx-auto mt-5 flex h-[280px] w-[280px] items-center justify-center rounded-xl bg-white p-2">
          <img v-if="dataUrl" :src="dataUrl" alt="QR code for the private link" class="h-full w-full" />
        </div>
        <BaseButton class="mt-5" variant="secondary" block @click="emit('close')">Close</BaseButton>
      </div>
    </div>
  </Teleport>
</template>
