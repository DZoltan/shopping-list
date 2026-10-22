<script setup lang="ts">
import type { HouseholdRole } from '#shared/constants'

useHead({ title: 'Kezelés' })

const toast = useToast()
const { user } = useUserSession()
const { data: me } = await useMe()
const { data: invites, refresh: refreshInvites } = await useFetch('/api/invites', { default: () => [] })
const { data: users, refresh: refreshUsers } = await useFetch('/api/admin/users', {
  default: () => [],
  immediate: !!user.value?.isAdmin,
})

const NEW_HOUSEHOLD = 0
const ownedHouseholds = computed(() => me.value?.households.filter((h) => h.role === 'owner') ?? [])
const canInvite = computed(() => !!user.value?.isAdmin || ownedHouseholds.value.length > 0)

const householdOptions = computed(() => [
  ...(user.value?.isAdmin ? me.value?.households ?? [] : ownedHouseholds.value).map((h) => ({ label: h.name, value: h.id })),
  ...(user.value?.isAdmin ? [{ label: 'Új, saját háztartás', value: NEW_HOUSEHOLD }] : []),
])
const roleOptions = [
  { label: 'Tag', value: 'member' },
  { label: 'Gazda (ő is meghívhat másokat)', value: 'owner' },
]

const form = reactive<{ name: string, householdId: number, role: HouseholdRole }>({
  name: '',
  householdId: householdOptions.value[0]?.value ?? NEW_HOUSEHOLD,
  role: 'member',
})
// Whoever starts a new household owns it
watch(() => form.householdId, (id) => {
  if (id === NEW_HOUSEHOLD) form.role = 'owner'
})

const created = ref<{ name: string, url: string }>()
const pending = ref(false)

async function createInvite() {
  if (!form.name.trim()) return
  pending.value = true
  try {
    const invite = await $fetch('/api/invites', {
      method: 'POST',
      body: {
        name: form.name,
        householdId: form.householdId === NEW_HOUSEHOLD ? null : form.householdId,
        role: form.role,
      },
    })
    created.value = { name: invite.name, url: invite.url }
    form.name = ''
    await refreshInvites()
  } catch {
    toast.add({ title: 'Nem sikerült létrehozni a meghívót', color: 'error' })
  } finally {
    pending.value = false
  }
}

const canShare = computed(() => import.meta.client && 'share' in navigator)

async function share() {
  if (!created.value) return
  try {
    await navigator.share({ title: 'Meghívó a Listák appba', text: `Szia ${created.value.name}! Itt a meghívód:`, url: created.value.url })
  } catch {
    // The user closed the share sheet
  }
}

async function copy() {
  if (!created.value) return
  await navigator.clipboard.writeText(created.value.url)
  toast.add({ title: 'Link kimásolva', color: 'success' })
}

async function revoke(id: number) {
  try {
    await $fetch(`/api/invites/${id}`, { method: 'DELETE' })
    await refreshInvites()
  } catch {
    toast.add({ title: 'Nem sikerült visszavonni', color: 'error' })
  }
}

// Recovery: a login link for someone who lost all their devices
const recovery = ref<{ name: string, url: string, expiresAt: string }>()

async function createRecoveryLink(target: { id: number, name: string }) {
  try {
    const link = await $fetch('/api/device-links', { method: 'POST', body: { userId: target.id } })
    recovery.value = { name: target.name, ...link }
  } catch {
    toast.add({ title: 'Nem sikerült linket készíteni', color: 'error' })
  }
}

const userToDelete = ref<{ id: number, name: string }>()

async function deleteUser() {
  if (!userToDelete.value) return
  try {
    await $fetch(`/api/admin/users/${userToDelete.value.id}`, { method: 'DELETE' })
    await refreshUsers()
  } catch {
    toast.add({ title: 'Nem sikerült törölni', color: 'error' })
  } finally {
    userToDelete.value = undefined
  }
}

const formatDate = (value: string) => new Date(value).toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' })
</script>

<template>
  <div class="space-y-10">
    <section class="space-y-4">
      <h1 class="text-xl font-semibold">Meghívás</h1>

      <p v-if="!canInvite" class="text-muted">
        Meghívni a háztartás gazdája tud. Kérd meg őt, ha valakit hozzá szeretnél adni.
      </p>

      <form v-else class="space-y-3" @submit.prevent="createInvite">
        <UFormField label="Kit hívsz meg?">
          <UInput v-model="form.name" placeholder="Név" class="w-full" />
        </UFormField>
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField label="Háztartás">
            <USelect v-model="form.householdId" :items="householdOptions" class="w-full" />
          </UFormField>
          <UFormField label="Szerep">
            <USelect v-model="form.role" :items="roleOptions" :disabled="form.householdId === NEW_HOUSEHOLD" class="w-full" />
          </UFormField>
        </div>
        <UButton type="submit" icon="i-lucide-link" label="Meghívó link készítése" :loading="pending" />
      </form>

      <UAlert
        v-if="created"
        color="success"
        variant="subtle"
        icon="i-lucide-circle-check"
        :title="`Meghívó kész: ${created.name}`"
        description="Küldd el neki a linket. Csak egyszer használható, és 7 napig érvényes. Később nem tudod újra megnézni, de bármikor készíthetsz újat."
      >
        <template #actions>
          <UButton v-if="canShare" icon="i-lucide-share-2" label="Megosztás" @click="share" />
          <UButton icon="i-lucide-copy" label="Link másolása" variant="outline" @click="copy" />
        </template>
      </UAlert>

      <div v-if="invites.length" class="space-y-2">
        <h2 class="text-sm font-medium text-muted">Függő meghívók</h2>
        <ul class="divide-y divide-default rounded-lg border border-default">
          <li v-for="invite in invites" :key="invite.id" class="flex items-center gap-3 px-4 py-3">
            <div class="min-w-0 flex-1">
              <p>{{ invite.name }}</p>
              <p class="text-sm text-muted">
                {{ invite.householdName ?? 'Új háztartás' }} · {{ invite.role === 'owner' ? 'gazda' : 'tag' }} ·
                lejár: {{ formatDate(invite.expiresAt) }}
              </p>
            </div>
            <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="sm" label="Visszavonás" @click="revoke(invite.id)" />
          </li>
        </ul>
      </div>
    </section>

    <section v-if="user?.isAdmin" class="space-y-4">
      <h2 class="text-xl font-semibold">Felhasználók</h2>
      <ul class="divide-y divide-default rounded-lg border border-default">
        <li v-for="u in users" :key="u.id" class="flex items-center gap-3 px-4 py-3">
          <div class="min-w-0 flex-1">
            <p class="flex items-center gap-2">
              {{ u.name }}
              <UBadge v-if="u.isAdmin" label="admin" variant="subtle" size="sm" />
            </p>
            <p class="text-sm text-muted">
              {{ u.households.map((h) => `${h.name} (${h.role === 'owner' ? 'gazda' : 'tag'})`).join(', ') || 'nincs háztartása' }}
              · {{ u.passkeys }} passkey
            </p>
          </div>
          <UButton
            v-if="u.id !== user.id"
            icon="i-lucide-key-round"
            variant="ghost"
            color="neutral"
            size="sm"
            label="Belépési link"
            @click="createRecoveryLink(u)"
          />
          <UButton
            v-if="u.id !== user.id"
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            size="sm"
            aria-label="Felhasználó törlése"
            @click="userToDelete = { id: u.id, name: u.name }"
          />
        </li>
      </ul>
    </section>

    <UModal
      :open="!!recovery"
      :title="`Belépési link: ${recovery?.name}`"
      description="Ha valaki minden eszközét elvesztette: a linkkel belép, és új passkey-t hozhat létre."
      @update:open="(open) => { if (!open) recovery = undefined }"
    >
      <template #body>
        <LoginLinkCard
          v-if="recovery"
          :url="recovery.url"
          :expires-at="recovery.expiresAt"
          hint="Küldd el neki. Aki megnyitja, az ő nevében lép be, ezért csak neki add oda."
        />
      </template>
    </UModal>

    <UModal
      :open="!!userToDelete"
      title="Felhasználó törlése"
      :description="`Biztosan törlöd ${userToDelete?.name} fiókját? A passkey-jei megszűnnek, a listák megmaradnak.`"
      @update:open="(open) => { if (!open) userToDelete = undefined }"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Mégse" variant="ghost" color="neutral" @click="userToDelete = undefined" />
          <UButton label="Törlés" color="error" @click="deleteUser" />
        </div>
      </template>
    </UModal>
  </div>
</template>
