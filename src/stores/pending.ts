import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

/** Hands a file chosen on the landing page to the send screen (survives the login redirect). */
export const usePendingFileStore = defineStore('pending-file', () => {
  const file = shallowRef<File | null>(null)
  function take(): File | null {
    const current = file.value
    file.value = null
    return current
  }
  return { file, take }
})
