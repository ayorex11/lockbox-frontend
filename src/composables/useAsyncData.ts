import { ref, shallowRef } from 'vue'
import { describeError } from '@/lib/errors'

/** Loads one chunk of data with loading/error state. A newer load() wins over a slower older one. */
export function useAsyncData<T>(fetcher: () => Promise<T>) {
  const data = shallowRef<T | null>(null)
  const loading = ref(true)
  const error = ref('')
  let latest = 0

  async function load(showSpinner = true) {
    const mine = ++latest
    if (showSpinner) loading.value = true
    error.value = ''
    try {
      const result = await fetcher()
      if (mine === latest) data.value = result
    } catch (e) {
      if (mine === latest) error.value = describeError(e)
    } finally {
      if (mine === latest) loading.value = false
    }
  }

  return { data, loading, error, load }
}
