<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'

const model = defineModel<string>({ required: true })
defineProps<{
  id: string
  label?: string
  placeholder?: string
  autocomplete?: 'current-password' | 'new-password' | 'off'
  invalid?: boolean
  minlength?: number
}>()
const visible = ref(false)
</script>

<template>
  <div>
    <label v-if="label" :for="id" class="label">{{ label }}</label>
    <div class="relative">
      <input
        :id="id"
        v-model="model"
        :type="visible ? 'text' : 'password'"
        class="field pr-12"
        :class="invalid ? 'border-error focus:border-error focus:ring-error/30' : ''"
        :placeholder="placeholder"
        :autocomplete="autocomplete ?? 'off'"
        :minlength="minlength"
        :aria-invalid="invalid || undefined"
      />
      <button
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-outline hover:text-on-surface"
        :aria-label="visible ? 'Hide password' : 'Show password'"
        @click="visible = !visible"
      >
        <Icon :name="visible ? 'visibility_off' : 'visibility'" :size="20" />
      </button>
    </div>
  </div>
</template>
