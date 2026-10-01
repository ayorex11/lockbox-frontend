import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const dark = ref(document.documentElement.classList.contains('dark'))

  function apply() {
    document.documentElement.classList.toggle('dark', dark.value)
    try { localStorage.setItem('lockbox:theme', dark.value ? 'dark' : 'light') } catch { /* private mode */ }
  }
  function toggle() {
    dark.value = !dark.value
    apply()
  }
  return { dark, toggle }
})
