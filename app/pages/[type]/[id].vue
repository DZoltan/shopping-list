<script setup lang="ts">
import type { DropdownMenuItem, FormSubmitEvent } from '@nuxt/ui'
import type { z } from 'zod'
import type { ListType } from '#shared/constants'
import { createItemSchema, updateListSchema } from '#shared/schemas'

// A new component per list, so switching lists starts from a clean state
definePageMeta({ key: (route) => route.fullPath })

const route = useRoute()
const toast = useToast()
const id = String(route.params.id)
const refreshLists = inject(REFRESH_LISTS, async () => {})

const { data: list, error, refresh } = await useFetch(`/api/lists/${id}`)
if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    statusMessage: error.value.statusCode === 404 ? 'A lista nem található' : 'Hiba történt',
    fatal: true,
  })
}
// A link with the wrong tab (e.g. /todo/5 for a shopping list) goes to the right one
if (list.value && list.value.type !== route.params.type) {
  await navigateTo(`/${list.value.type}/${id}`, { replace: true })
}
useRefreshOnFocus(refresh)
useHead({ title: () => list.value?.name ?? 'Lista' })

type ListItem = NonNullable<typeof list.value>['items'][number]
const meta = computed(() => LIST_TYPE_META[(list.value?.type ?? 'shopping') as ListType])

const byPosition = (a: ListItem, b: ListItem) => a.position - b.position || a.id - b.id
const openItems = computed(() => list.value?.items.filter((i) => !i.done).sort(byPosition) ?? [])
const doneItems = computed(() => list.value?.items.filter((i) => i.done).sort(byPosition) ?? [])
const showDone = ref(true)

// Who added an item is only worth showing when it was someone else
const { user } = useUserSession()
const addedByOther = (item: ListItem) => (item.addedBy !== user.value?.id ? item.addedByName : null)

// useFetch data is a shallowRef in Nuxt 4: mutating nested fields is not tracked,
// so every change assigns a new list object
function setItems(update: (items: ListItem[]) => ListItem[]) {
  if (list.value) list.value = { ...list.value, items: update(list.value.items) }
}

function failed(title: string) {
  toast.add({ title, color: 'error' })
  // The local state may now be wrong, so reload it from the server
  refresh()
}

// --- add item ---
const showDetails = ref(false)
const newItem = reactive({ text: '', quantity: '', reason: '' })

async function addItem(event: FormSubmitEvent<z.output<typeof createItemSchema>>) {
  try {
    const item = await $fetch(`/api/lists/${id}/items`, { method: 'POST', body: event.data })
    setItems((items) => [...items, item])
    Object.assign(newItem, { text: '', quantity: '', reason: '' })
    refreshLists()
  } catch {
    failed('Nem sikerült hozzáadni a tételt')
  }
}

// --- toggle / delete item (optimistic: update the screen first, then the server) ---
async function setDone(item: ListItem, done: boolean) {
  setItems((items) => items.map((i) => (i.id === item.id ? { ...i, done } : i)))
  try {
    await $fetch(`/api/items/${item.id}`, { method: 'PATCH', body: { done } })
    refreshLists()
  } catch {
    failed('Nem sikerült menteni')
  }
}

async function removeItem(item: ListItem) {
  setItems((items) => items.filter((i) => i.id !== item.id))
  try {
    await $fetch(`/api/items/${item.id}`, { method: 'DELETE' })
    refreshLists()
  } catch {
    failed('Nem sikerült törölni a tételt')
  }
}

// --- rename / delete list ---
const renameOpen = ref(false)
const renameState = reactive({ name: '' })
const confirmDelete = ref(false)

const listMenu = computed<DropdownMenuItem[][]>(() => [
  [
    { label: 'Frissítés', icon: 'i-lucide-refresh-cw', onSelect: () => refresh() },
    {
      label: 'Átnevezés',
      icon: 'i-lucide-pencil',
      onSelect: () => {
        renameState.name = list.value?.name ?? ''
        renameOpen.value = true
      },
    },
  ],
  [{ label: 'Lista törlése', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => { confirmDelete.value = true } }],
])

async function rename(event: FormSubmitEvent<z.output<typeof updateListSchema>>) {
  try {
    const updated = await $fetch(`/api/lists/${id}`, { method: 'PATCH', body: event.data })
    if (list.value) list.value = { ...list.value, name: updated.name }
    renameOpen.value = false
    refreshLists()
  } catch {
    failed('Nem sikerült átnevezni')
  }
}

async function deleteList() {
  try {
    await $fetch(`/api/lists/${id}`, { method: 'DELETE' })
    await refreshLists()
    await navigateTo(`/${route.params.type}`)
  } catch {
    confirmDelete.value = false
    failed('Nem sikerült törölni a listát')
  }
}
</script>

<template>
  <article v-if="list" class="overflow-hidden rounded-xl border border-default bg-default">
    <header class="flex items-center gap-2 border-b border-default px-4 py-3 sm:px-5">
      <UButton :to="`/${list.type}`" icon="i-lucide-layout-grid" variant="ghost" color="neutral" aria-label="Összes lista" class="lg:hidden" />
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-xl font-semibold">{{ list.name }}</h1>
        <p class="text-sm text-muted">
          {{ openItems.length ? `${openItems.length} nyitott tétel` : 'nincs nyitott tétel' }}
        </p>
      </div>
      <UDropdownMenu :items="listMenu">
        <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" aria-label="Lista műveletek" />
      </UDropdownMenu>
    </header>

    <UForm :schema="createItemSchema" :state="newItem" class="space-y-2 border-b border-default bg-elevated/40 px-4 py-3 sm:px-5" @submit="addItem">
      <div class="flex items-start gap-2">
        <UFormField name="text" class="flex-1">
          <UInput
            v-model="newItem.text"
            :placeholder="meta.itemPlaceholder"
            aria-label="Új tétel"
            class="w-full"
            size="lg"
            icon="i-lucide-plus"
          />
        </UFormField>
        <UButton
          :icon="showDetails ? 'i-lucide-chevron-up' : 'i-lucide-sliders-horizontal'"
          variant="ghost"
          color="neutral"
          size="lg"
          :aria-label="showDetails ? 'Részletek elrejtése' : 'Részletek'"
          @click="showDetails = !showDetails"
        />
        <UButton type="submit" label="Hozzáadás" size="lg" class="hidden sm:inline-flex" />
        <UButton type="submit" icon="i-lucide-arrow-up" size="lg" aria-label="Hozzáadás" class="sm:hidden" />
      </div>
      <div v-if="showDetails" class="grid gap-2 sm:grid-cols-[12rem_1fr]">
        <UFormField v-if="list.type === 'shopping'" name="quantity">
          <UInput v-model="newItem.quantity" placeholder="Mennyiség, pl. 2 kg" class="w-full" />
        </UFormField>
        <UFormField name="reason" :class="list.type === 'shopping' ? '' : 'sm:col-span-2'">
          <UInput v-model="newItem.reason" placeholder="Miért? (opcionális)" class="w-full" />
        </UFormField>
      </div>
    </UForm>

    <ul v-if="openItems.length" class="divide-y divide-default">
      <li v-for="item in openItems" :key="item.id" class="group flex items-start gap-3 px-4 py-3 hover:bg-elevated/40 sm:px-5">
        <UCheckbox
          :model-value="item.done"
          :aria-label="item.text"
          size="lg"
          class="mt-0.5"
          @update:model-value="setDone(item, $event === true)"
        />
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="break-words">{{ item.text }}</span>
            <UBadge v-if="item.quantity" :label="item.quantity" variant="subtle" size="sm" />
          </div>
          <p v-if="item.reason || addedByOther(item)" class="text-sm text-muted">
            {{ [item.reason, addedByOther(item)].filter(Boolean).join(' · ') }}
          </p>
        </div>
        <UButton
          icon="i-lucide-x"
          variant="ghost"
          color="neutral"
          size="sm"
          aria-label="Tétel törlése"
          class="sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          @click="removeItem(item)"
        />
      </li>
    </ul>
    <div v-else class="flex flex-col items-center gap-2 px-4 py-12 text-center text-muted">
      <UIcon :name="doneItems.length ? 'i-lucide-party-popper' : meta.icon" class="size-10" />
      <p>{{ doneItems.length ? 'Minden kész!' : 'A lista még üres. Írd be fent az első tételt.' }}</p>
    </div>

    <section v-if="doneItems.length" class="border-t border-default">
      <button
        type="button"
        class="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted hover:bg-elevated/40 sm:px-5"
        :aria-expanded="showDone"
        @click="showDone = !showDone"
      >
        <UIcon :name="showDone ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-4" />
        Kész ({{ doneItems.length }})
      </button>
      <ul v-if="showDone" class="divide-y divide-default">
        <li v-for="item in doneItems" :key="item.id" class="group flex items-center gap-3 px-4 py-2 sm:px-5">
          <UCheckbox
            :model-value="item.done"
            :aria-label="item.text"
            size="lg"
            @update:model-value="setDone(item, $event === true)"
          />
          <span class="min-w-0 flex-1 break-words text-muted line-through">{{ item.text }}</span>
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            color="neutral"
            size="sm"
            aria-label="Tétel törlése"
            class="sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            @click="removeItem(item)"
          />
        </li>
      </ul>
    </section>

    <UModal v-model:open="renameOpen" title="Lista átnevezése">
      <template #body>
        <UForm :schema="updateListSchema" :state="renameState" class="space-y-4" @submit="rename">
          <UFormField label="Név" name="name">
            <UInput v-model="renameState.name" class="w-full" autofocus />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton label="Mégse" variant="ghost" color="neutral" @click="renameOpen = false" />
            <UButton type="submit" label="Mentés" />
          </div>
        </UForm>
      </template>
    </UModal>

    <UModal v-model:open="confirmDelete" title="Lista törlése" :description="`Biztosan törlöd a(z) „${list.name}” listát az összes tételével együtt?`">
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Mégse" variant="ghost" color="neutral" @click="confirmDelete = false" />
          <UButton label="Törlés" color="error" @click="deleteList" />
        </div>
      </template>
    </UModal>
  </article>
</template>
