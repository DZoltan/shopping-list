<script setup lang="ts">
useHead({ title: 'Profil' })

const toast = useToast()
const { user } = useUserSession()
const { register } = useWebAuthn()
const { data: me } = await useMe()
const { data: passkeys, refresh: refreshPasskeys } = await useFetch('/api/me/passkeys', { default: () => [] })

// --- log in on another device ---
type DeviceLink = { url: string, expiresAt: string }
const link = ref<DeviceLink>()
const creating = ref(false)

async function createLink() {
  creating.value = true
  try {
    // Explicit type: inferring it from the route table hits TypeScript's recursion limit here
    link.value = await $fetch<DeviceLink>('/api/device-links', { method: 'POST', body: {} })
  } catch {
    toast.add({ title: 'Nem sikerült linket készíteni', color: 'error' })
  } finally {
    creating.value = false
  }
}

// --- passkeys ---
async function addPasskey() {
  if (!user.value) return
  try {
    await register({ userName: user.value.name, displayName: user.value.name })
    await refreshPasskeys()
    toast.add({ title: 'Passkey hozzáadva ehhez az eszközhöz', color: 'success' })
  } catch (e) {
    toast.add({ title: passkeyErrorMessage(e), color: 'error' })
  }
}

async function removePasskey(id: string) {
  try {
    await $fetch(`/api/me/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' })
    await refreshPasskeys()
    toast.add({ title: 'Passkey törölve, a többi eszközödön újra be kell lépni', color: 'success' })
  } catch (e) {
    toast.add({ title: (e as { statusCode?: number }).statusCode === 400 ? 'Az utolsó passkey-t nem törölheted.' : 'Nem sikerült törölni', color: 'error' })
  }
}

// --- sessions ---
const endingSessions = ref(false)

async function endOtherSessions() {
  endingSessions.value = true
  try {
    await $fetch('/api/me/sessions/end-others', { method: 'POST' })
    toast.add({ title: 'Minden más eszközön kijelentkeztél', color: 'success' })
  } catch {
    toast.add({ title: 'Nem sikerült kijelentkeztetni a többi eszközt', color: 'error' })
  } finally {
    endingSessions.value = false
  }
}

const formatDate =(value: string | null) =>
  value ? new Date(value).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' }) : 'még nem'
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-10">
    <section class="space-y-1">
      <h1 class="text-xl font-semibold">{{ user?.name }}</h1>
      <p class="text-muted">
        {{ me?.households.map((h) => `${h.name} (${h.role === 'owner' ? 'gazda' : 'tag'})`).join(', ') }}
      </p>
    </section>

    <section class="space-y-3">
      <h2 class="text-lg font-semibold">Bejelentkezés más eszközről</h2>
      <p class="text-sm text-muted">
        Olvasd be a QR-kódot a másik eszközzel, vagy küldd át magadnak a linket. Aki látja a kódot, be tud lépni a fiókodba, ezért csak 10 percig él.
      </p>
      <LoginLinkCard
        v-if="link"
        :url="link.url"
        :expires-at="link.expiresAt"
        @expired="link = undefined"
      />
      <UButton
        :icon="link ? 'i-lucide-refresh-cw' : 'i-lucide-qr-code'"
        :label="link ? 'Új link' : 'QR-kód és link készítése'"
        :variant="link ? 'ghost' : 'solid'"
        :loading="creating"
        @click="createLink"
      />
    </section>

    <section class="space-y-3">
      <h2 class="text-lg font-semibold">Passkey-k</h2>
      <ul class="divide-y divide-default rounded-lg border border-default">
        <li v-for="(passkey, index) in passkeys" :key="passkey.id" class="flex items-center gap-3 px-4 py-3">
          <UIcon :name="passkey.backedUp ? 'i-lucide-cloud' : 'i-lucide-smartphone'" class="size-5 text-muted" />
          <div class="min-w-0 flex-1">
            <p>Passkey {{ index + 1 }}</p>
            <p class="text-sm text-muted">
              {{ passkey.backedUp ? 'szinkronizált' : 'csak egy eszközön' }} ·
              létrehozva: {{ formatDate(passkey.createdAt) }} · utoljára: {{ formatDate(passkey.lastUsedAt) }}
            </p>
          </div>
          <UButton
            v-if="passkeys.length > 1"
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            size="sm"
            aria-label="Passkey törlése"
            @click="removePasskey(passkey.id)"
          />
        </li>
      </ul>
      <UButton icon="i-lucide-fingerprint" label="Passkey hozzáadása ehhez az eszközhöz" variant="outline" @click="addPasskey" />
    </section>

    <section class="space-y-3">
      <h2 class="text-lg font-semibold">Bejelentkezett eszközök</h2>
      <p class="text-sm text-muted">
        Ha elveszett egy eszközöd, vagy máshol bejelentkezve hagytad a fiókod, itt mindenhonnan kijelentkezhetsz. Ez az eszköz bejelentkezve marad. Passkey törlésekor ez automatikusan megtörténik.
      </p>
      <UButton
        icon="i-lucide-log-out"
        label="Kijelentkezés minden más eszközön"
        variant="outline"
        color="error"
        :loading="endingSessions"
        @click="endOtherSessions"
      />
    </section>
  </div>
</template>
