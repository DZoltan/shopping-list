<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)
</script>

<template>
  <UApp>
    <UContainer class="flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 text-center">
      <UIcon :name="notFound ? 'i-lucide-search-x' : 'i-lucide-triangle-alert'" class="size-12 text-muted" />
      <h1 class="text-xl font-semibold">
        {{ notFound ? (error.statusMessage || 'Az oldal nem található') : 'Hiba történt' }}
      </h1>
      <UButton label="Vissza a listákhoz" icon="i-lucide-arrow-left" @click="clearError({ redirect: '/' })" />
    </UContainer>
  </UApp>
</template>
