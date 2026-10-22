<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { hu } from '@nuxt/ui/locale'

const { loggedIn, user, clear } = useUserSession()

async function logout() {
  await clear()
  clearNuxtData()
  // Drop cached pages and API responses, so the next person on this device sees nothing of ours
  if (import.meta.client && 'caches' in window) await caches.delete('pages-and-api')
  await navigateTo('/login')
}

const menu = computed<DropdownMenuItem[][]>(() => [
  [{ label: user.value?.name ?? '', type: 'label' }],
  [
    { label: 'Profil és eszközök', icon: 'i-lucide-circle-user', to: '/profile' },
    { label: 'Kezelés és meghívás', icon: 'i-lucide-users', to: '/admin' },
  ],
  [{ label: 'Kijelentkezés', icon: 'i-lucide-log-out', onSelect: logout }],
])
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
          <UDropdownMenu v-if="loggedIn" :items="menu">
            <UButton icon="i-lucide-circle-user" variant="ghost" color="neutral" aria-label="Fiók" />
          </UDropdownMenu>
        </div>
      </UContainer>
    </header>

    <UMain>
      <UContainer class="max-w-2xl py-6">
        <InAppBrowserNotice />
        <NuxtPage />
      </UContainer>
    </UMain>
  </UApp>
</template>
