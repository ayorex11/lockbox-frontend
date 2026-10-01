import { onBeforeUnmount, onMounted, ref } from 'vue'

/** A reactive "current time" that ticks, for countdowns. */
export function useNow(intervalMs = 30_000) {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => { timer = setInterval(() => (now.value = Date.now()), intervalMs) })
  onBeforeUnmount(() => clearInterval(timer))
  return now
}
