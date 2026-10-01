import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast { id: number; kind: 'success' | 'error' | 'info'; message: string }

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  let nextId = 1

  function push(kind: Toast['kind'], message: string, ms = 4000) {
    const id = nextId++
    toasts.value.push({ id, kind, message })
    setTimeout(() => dismiss(id), ms)
  }
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }
  return {
    toasts, dismiss,
    success: (m: string) => push('success', m),
    error: (m: string) => push('error', m, 6000),
    info: (m: string) => push('info', m),
  }
})
