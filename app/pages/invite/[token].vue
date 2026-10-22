<script setup lang="ts">
import { householdNameSchema } from '#shared/schemas'

useHead({ title: 'Meghívó' })

const route = useRoute()
const token = String(route.params.token)
const { register, isSupported } = useWebAuthn()
const { loggedIn, fetch: refreshSession } = useUserSession()

const { data: invite, error: lookupError } = await useFetch('/api/invites/lookup', { query: { token } })

const form = reactive({ name: invite.value?.name ?? '', householdName: '' })
const newHousehold = computed(() => invite.value && !invite.value.householdName)
const pending = ref(false)
const error = ref<string>()

async function accept() {
  const name = form.name.trim()
  const householdName = householdNameSchema.safeParse(form.householdName)
  if (!name) {
    error.value = 'Add meg a neved.'
    return
  }
  pending.value = true
  error.value = undefined
  try {
    await register({
      userName: name,
      displayName: name,
      inviteToken: token,
      householdName: householdName.success ? householdName.data : undefined,
    })
    await refreshSession()
    await navigateTo('/')
  } catch (e) {
    error.value = passkeyErrorMessage(e)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-sm space-y-6 py-6">
    <template v-if="invite">
      <div class="space-y-2 text-center">
        <UIcon name="i-lucide-mail-open" class="size-12 text-primary" />
        <h1 class="text-2xl font-semibold">Szia, {{ invite.name }}!</h1>
        <p class="text-muted">
          <template v-if="invite.householdName">
            {{ invite.invitedBy }} meghívott a(z) <strong>{{ invite.householdName }}</strong> háztartásba.
          </template>
          <template v-else>
            {{ invite.invitedBy }} meghívott a Listák appba, a saját háztartásoddal.
          </template>
        </p>
      </div>

      <UAlert
        v-if="loggedIn"
        color="warning"
        variant="subtle"
        description="Már be vagy jelentkezve. A meghívót annak kell megnyitnia, akinek szól; ha ez te vagy, előbb jelentkezz ki."
      />

      <form class="space-y-4" @submit.prevent="accept">
        <UFormField label="A neved" description="Így látják a többiek, ki mit tett fel a listára.">
          <UInput v-model="form.name" class="w-full" size="lg" autocomplete="name" />
        </UFormField>
        <UFormField v-if="newHousehold" label="A háztartásod neve" description="Később is megváltoztatható.">
          <UInput v-model="form.householdName" :placeholder="`${form.name || 'Saját'} háztartása`" class="w-full" />
        </UFormField>

        <UButton
          type="submit"
          size="xl"
          block
          icon="i-lucide-fingerprint"
          label="Passkey létrehozása és belépés"
          :loading="pending"
          :disabled="!isSupported || loggedIn"
        />
        <p class="text-center text-sm text-muted">
          A passkey-t a telefonod vagy a géped tárolja; ujjlenyomattal, arcfelismeréssel vagy PIN-kóddal lépsz be vele. Jelszó nincs.
        </p>
      </form>

      <UAlert v-if="error" color="error" variant="subtle" :description="error" />
    </template>

    <div v-else-if="lookupError" class="space-y-4 text-center">
      <UIcon name="i-lucide-link-2-off" class="size-12 text-muted" />
      <h1 class="text-xl font-semibold">Ez a meghívó nem érvényes</h1>
      <p class="text-muted">Lehet, hogy már felhasználták, visszavonták vagy lejárt. Kérj újat attól, aki küldte.</p>
      <UButton to="/login" variant="ghost" label="Belépés" />
    </div>
  </div>
</template>
