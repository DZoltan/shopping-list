<script setup lang="ts">
import { hu } from '@nuxt/ui/locale'
</script>

<template>
  <UApp :locale="hu">
    <NuxtPwaManifest />
    <NuxtPwaAssets />
    <NuxtRouteAnnouncer />

    <header class="sticky top-0 z-10 border-b border-default bg-default/90 backdrop-blur">
      <UContainer class="flex h-14 max-w-2xl items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2 font-semibold">
          <img src="/icon.svg" alt="" class="size-7">
          Listák
        </NuxtLink>
        <div class="flex items-center gap-1">
          <UButton
            v-if="$pwa?.showInstallPrompt && !$pwa?.isPWAInstalled"
            icon="i-lucide-download"
            variant="ghost"
            label="Telepítés"
            @click="$pwa.install()"
          />
          <UColorModeButton />
        </div>
      </UContainer>
    </header>

    <UMain>
      <UContainer class="max-w-2xl py-6">
        <NuxtPage />
      </UContainer>
    </UMain>
  </UApp>
</template>
