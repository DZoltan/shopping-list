<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { z } from 'zod'
import { createItemSchema } from '#shared/schemas'

const route = useRoute()
const toast = useToast()
const id = String(route.params.id)

const { data: list, error, refresh } = await useFetch(`/api/lists/${id}`)
if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    statusMessage: error.value.statusCode === 404 ? 'A lista nem található' : 'Hiba történt',
    fatal: true,
  })
}
useRefreshOnFocus(refresh)
useHead({ title: () => list.value?.name ?? 'Lista' })

type ListItem = NonNullable<typeof list.value>['items'][number]

const byPosition = (a: ListItem, b: ListItem) => a.position - b.position || a.id - b.id
const openItems = computed(() => list.value?.items.filter((i) => !i.done).sort(byPosition) ?? [])
const doneItems = computed(() => list.value?.items.filter((i) => i.done).sort(byPosition) ?? [])

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
  } catch {
    failed('Nem sikerült hozzáadni a tételt')
  }
}

// --- toggle / delete item (optimistic: update the screen first, then the server) ---
async function setDone(item: ListItem, done: boolean) {
  setItems((items) => items.map((i) => (i.id === item.id ? { ...i, done } : i)))
  try {
    await $fetch(`/api/items/${item.id}`, { method: 'PATCH', body: { done } })
  } catch {
    failed('Nem sikerült menteni')
  }
}

async function removeItem(item: ListItem) {
  setItems((items) => items.filter((i) => i.id !== item.id))
  try {
    await $fetch(`/api/items/${item.id}`, { method: 'DELETE' })
  } catch {
    failed('Nem sikerült törölni a tételt')
  }
}

// --- delete list ---
const confirmDelete = ref(false)

async function deleteList() {
  try {
    await $fetch(`/api/lists/${id}`, { method: 'DELETE' })
    await navigateTo('/')
  } catch {
    confirmDelete.value = false
    failed('Nem sikerült törölni a listát')
  }
}
</script>

<template>
  <div v-if="list" class="space-y-6">
    <div class="flex items-center gap-2">
      <UButton to="/" icon="i-lucide-arrow-left" variant="ghost" color="neutral" aria-label="Vissza" />
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-xl font-semibold">{{ list.name }}</h1>
        <p class="text-sm text-muted">
          {{ list.type === 'shopping' ? 'Bevásárlólista' : 'Teendőlista' }} · {{ openItems.length }} nyitott
        </p>
      </div>
      <UButton icon="i-lucide-refresh-cw" variant="ghost" color="neutral" aria-label="Frissítés" @click="refresh()" />
      <UButton icon="i-lucide-trash-2" variant="ghost" color="error" aria-label="Lista törlése" @click="confirmDelete = true" />
    </div>

    <UForm :schema="createItemSchema" :state="newItem" class="space-y-2" @submit="addItem">
      <div class="flex items-start gap-2">
        <UFormField name="text" class="flex-1">
          <UInput
            v-model="newItem.text"
            :placeholder="list.type === 'shopping' ? 'Mit kell venni?' : 'Mit kell csinálni?'"
            aria-label="Új tétel"
            class="w-full"
            size="lg"
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
        <UButton type="submit" icon="i-lucide-plus" size="lg" aria-label="Hozzáadás" />
      </div>
      <div v-if="showDetails" class="grid gap-2 sm:grid-cols-[10rem_1fr]">
        <UFormField v-if="list.type === 'shopping'" name="quantity">
          <UInput v-model="newItem.quantity" placeholder="Mennyiség, pl. 2 kg" class="w-full" />
        </UFormField>
        <UFormField name="reason" :class="list.type === 'shopping' ? '' : 'sm:col-span-2'">
          <UInput v-model="newItem.reason" placeholder="Miért? (opcionális)" class="w-full" />
        </UFormField>
      </div>
    </UForm>

    <ul v-if="openItems.length" class="divide-y divide-default rounded-lg border border-default">
      <li v-for="item in openItems" :key="item.id" class="flex items-start gap-3 px-4 py-3">
        <UCheckbox
          :model-value="item.done"
          :aria-label="item.text"
          class="mt-0.5"
          @update:model-value="setDone(item, $event === true)"
        />
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="break-words">{{ item.text }}</span>
            <UBadge v-if="item.quantity" :label="item.quantity" variant="subtle" size="sm" />
          </div>
          <p v-if="item.reason" class="text-sm text-muted">{{ item.reason }}</p>
        </div>
        <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="xs" aria-label="Tétel törlése" @click="removeItem(item)" />
      </li>
    </ul>
    <p v-else class="py-6 text-center text-muted">
      {{ doneItems.length ? 'Minden kész! 🎉' : 'A lista még üres.' }}
    </p>

    <section v-if="doneItems.length" class="space-y-2">
      <h2 class="text-sm font-medium text-muted">Kész ({{ doneItems.length }})</h2>
      <ul class="divide-y divide-default rounded-lg border border-default opacity-70">
        <li v-for="item in doneItems" :key="item.id" class="flex items-start gap-3 px-4 py-2">
          <UCheckbox
            :model-value="item.done"
            :aria-label="item.text"
            class="mt-0.5"
            @update:model-value="setDone(item, $event === true)"
          />
          <span class="min-w-0 flex-1 break-words text-muted line-through">{{ item.text }}</span>
          <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="xs" aria-label="Tétel törlése" @click="removeItem(item)" />
        </li>
      </ul>
    </section>

    <UModal v-model:open="confirmDelete" title="Lista törlése" :description="`Biztosan törlöd a(z) „${list.name}” listát az összes tételével együtt?`">
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Mégse" variant="ghost" color="neutral" @click="confirmDelete = false" />
          <UButton label="Törlés" color="error" @click="deleteList" />
        </div>
      </template>
    </UModal>
  </div>
</template>
