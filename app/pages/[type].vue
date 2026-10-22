<script setup lang="ts">
import { LIST_TYPES, type ListType } from '#shared/constants'

// Parent route of /shopping and /todo: the list tiles; the open list renders in <NuxtPage />.
// Unknown types (e.g. /foo) become a 404.
definePageMeta({
  validate: (route) => (LIST_TYPES as readonly string[]).includes(String(route.params.type)),
})

const route = useRoute()
const type = computed(() => route.params.type as ListType)
const selectedId = computed(() => (route.params.id ? Number(route.params.id) : undefined))
const meta = computed(() => LIST_TYPE_META[type.value])

const { data: me } = await useMe()
const { data: lists, refresh } = await useFetch('/api/lists', { query: { type }, default: () => [] })
useRefreshOnFocus(refresh)
provide(REFRESH_LISTS, refresh)
useHead({ title: () => meta.value.tab })

const households = computed(() => me.value?.households ?? [])
const householdName = (id: number) => (households.value.length > 1 ? households.value.find((h) => h.id === id)?.name : undefined)

const newListOpen = ref(false)
async function onCreated(id: number) {
  await refresh()
  await navigateTo(`/${type.value}/${id}`)
}
</script>

<template>
  <UAlert
    v-if="me && !households.length"
    color="warning"
    variant="subtle"
    title="Nem vagy tagja egy háztartásnak sem"
    description="Kérj meghívót valakitől, hogy lásd a közös listákat."
  />

  <!-- Overview: big tiles in a grid -->
  <div v-else-if="!selectedId" class="space-y-4">
    <h1 class="flex items-center gap-2 text-2xl font-semibold">
      <UIcon :name="meta.icon" class="size-6 text-primary" />
      {{ meta.tab }}
    </h1>
    <div class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      <ListTile
        v-for="list in lists"
        :key="list.id"
        :to="`/${type}/${list.id}`"
        :name="list.name"
        :open-count="list.openCount"
        :done-count="list.doneCount"
        :household="householdName(list.householdId)"
      />
      <button
        type="button"
        class="flex min-h-28 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-default text-muted transition hover:border-primary hover:text-primary"
        @click="newListOpen = true"
      >
        <UIcon name="i-lucide-plus" class="size-6" />
        <span class="font-medium">Új lista</span>
      </button>
    </div>
    <p v-if="!lists.length" class="text-muted">{{ meta.emptyText }} Kezdd egy új listával!</p>
  </div>

  <!-- A list is open: tiles become a sidebar (desktop) or a scrollable strip (mobile) -->
  <div v-else class="lg:grid lg:grid-cols-[17rem_1fr] lg:items-start lg:gap-8">
    <nav aria-label="Listák" class="-mx-4 mb-4 lg:sticky lg:top-24 lg:mx-0 lg:mb-0">
      <div class="flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
        <ListTile
          v-for="list in lists"
          :key="list.id"
          :to="`/${type}/${list.id}`"
          :name="list.name"
          :open-count="list.openCount"
          :done-count="list.doneCount"
          :household="householdName(list.householdId)"
          :active="list.id === selectedId"
          compact
          class="w-40 shrink-0 lg:w-auto"
        />
        <UButton
          icon="i-lucide-plus"
          label="Új lista"
          variant="ghost"
          class="shrink-0 justify-center lg:justify-start"
          @click="newListOpen = true"
        />
      </div>
    </nav>
    <NuxtPage />
  </div>

  <NewListModal v-model:open="newListOpen" :type="type" :households="households" @created="onCreated" />
</template>
