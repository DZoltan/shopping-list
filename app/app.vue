<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { hu } from '@nuxt/ui/locale'
import { LIST_TYPES } from '#shared/constants'

const { loggedIn, user, clear } = useUserSession()

async function logout() {
  await clear()
  clearNuxtData()
  // Drop cached pages and API responses, so the next person on this device sees nothing of ours
  if (import.meta.client && 'caches' in window) await caches.delete('pages-and-api')
  await navigateTo('/login')
}

const route = useRoute()
const tabs = LIST_TYPES.map((type) => ({ type, to: `/${type}`, ...LIST_TYPE_META[type] }))
const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`)

const menu = computed<DropdownMenuItem[][]>(() => [
  [{ label: user.value?.name ?? '', type: 'label' }],
  [
    { label: 'Profil és eszközök', icon: 'i-lucide-circle-user', to: '/profile' },
    { label: 'Háztartás és meghívás', icon: 'i-lucide-users', to: '/admin' },
  ],
  [{ label: 'Kijelentkezés', icon: 'i-lucide-log-out', onSelect: logout }],
])
</script>

<template>
  <UApp :locale="hu">
    <NuxtPwaManifest />
    <NuxtPwaAssets />
    <NuxtRouteAnnouncer />

    <header class="sticky top-0 z-20 border-b border-default bg-default/90 backdrop-blur">
      <UContainer class="flex h-16 max-w-6xl items-center gap-6">
        <NuxtLink to="/" class="flex shrink-0 items-center gap-2 text-lg font-semibold">
          <img src="/icon.svg" alt="" class="size-8">
          Listák
        </NuxtLink>

        <!-- Desktop: tabs next to the logo -->
        <nav v-if="loggedIn" aria-label="Fő menü" class="hidden h-full items-stretch gap-1 sm:flex">
          <NuxtLink
            v-for="tab in tabs"
            :key="tab.type"
            :to="tab.to"
            class="flex items-center gap-2 border-b-2 px-3 font-medium transition"
            :class="isActive(tab.to) ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-default'"
          >
            <UIcon :name="tab.icon" class="size-5" />
            {{ tab.tab }}
          </NuxtLink>
        </nav>

        <div class="ml-auto flex items-center gap-1">
          <UButton
            v-if="$pwa?.showInstallPrompt && !$pwa?.isPWAInstalled"
            icon="i-lucide-download"
            variant="ghost"
            label="Telepítés"
            @click="$pwa.install()"
          />
          <UColorModeButton />
          <UDropdownMenu v-if="loggedIn" :items="menu">
            <UButton variant="ghost" color="neutral" aria-label="Fiók" class="rounded-full p-1">
              <UAvatar :alt="user?.name" size="sm" />
            </UButton>
          </UDropdownMenu>
        </div>
      </UContainer>

      <!-- Mobile: tabs as a full-width second row -->
      <nav v-if="loggedIn" aria-label="Fő menü" class="grid grid-cols-2 border-t border-default sm:hidden">
        <NuxtLink
          v-for="tab in tabs"
          :key="tab.type"
          :to="tab.to"
          class="flex items-center justify-center gap-2 border-b-2 py-2.5 text-sm font-medium"
          :class="isActive(tab.to) ? 'border-primary text-primary' : 'border-transparent text-muted'"
        >
          <UIcon :name="tab.icon" class="size-5" />
          {{ tab.tab }}
        </NuxtLink>
      </nav>
    </header>

    <UMain>
      <UContainer class="max-w-6xl py-6">
        <InAppBrowserNotice />
        <NuxtPage />
      </UContainer>
    </UMain>
  </UApp>
</template>
