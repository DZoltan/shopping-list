<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ListType } from '#shared/constants'
import { createListSchema } from '#shared/schemas'

const toast = useToast()
const { data: me } = await useMe()
const { data: lists, refresh, status } = await useFetch('/api/lists', { default: () => [] })
useRefreshOnFocus(refresh)

const households = computed(() => me.value?.households ?? [])
const multipleHouseholds = computed(() => households.value.length > 1)
const householdName = (id: number) => households.value.find((h) => h.id === id)?.name
const householdOptions = computed(() => households.value.map((h) => ({ label: h.name, value: h.id })))

const sections: { type: ListType, title: string, icon: string, placeholder: string }[] = [
  { type: 'shopping', title: 'Bevásárlólisták', icon: 'i-lucide-shopping-cart', placeholder: 'pl. Heti nagybevásárlás' },
  { type: 'todo', title: 'Teendők', icon: 'i-lucide-list-checks', placeholder: 'pl. Ház körül' },
]

const nameSchema = createListSchema.pick({ name: true })
const forms = reactive<Record<ListType, { name: string, householdId?: number }>>({
  shopping: { name: '' },
  todo: { name: '' },
})
// Preselect the first household once it is known
watchEffect(() => {
  for (const form of Object.values(forms)) form.householdId ??= households.value[0]?.id
})

const listsOf = (type: ListType) => lists.value.filter((l) => l.type === type)

async function createList(type: ListType, event: FormSubmitEvent<{ name: string }>) {
  try {
    const list = await $fetch('/api/lists', {
      method: 'POST',
      body: { type, name: event.data.name, householdId: forms[type].householdId },
    })
    forms[type].name = ''
    await navigateTo(`/lists/${list.id}`)
  } catch {
    toast.add({ title: 'Nem sikerült létrehozni a listát', color: 'error' })
  }
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

  <div v-else class="space-y-8">
    <section v-for="section in sections" :key="section.type" class="space-y-3">
      <h2 class="flex items-center gap-2 text-lg font-semibold">
        <UIcon :name="section.icon" class="size-5 text-primary" />
        {{ section.title }}
      </h2>

      <ul v-if="listsOf(section.type).length" class="divide-y divide-default rounded-lg border border-default">
        <li v-for="list in listsOf(section.type)" :key="list.id">
          <NuxtLink
            :to="`/lists/${list.id}`"
            class="flex items-center justify-between gap-2 px-4 py-3 hover:bg-elevated/50"
          >
            <span class="min-w-0 truncate">{{ list.name }}</span>
            <span class="flex shrink-0 items-center gap-2">
              <UBadge v-if="multipleHouseholds" :label="householdName(list.householdId)" variant="subtle" color="neutral" size="sm" />
              <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
            </span>
          </NuxtLink>
        </li>
      </ul>
      <p v-else-if="status !== 'pending'" class="text-sm text-muted">
        Még nincs ilyen lista.
      </p>

      <UForm
        :schema="nameSchema"
        :state="forms[section.type]"
        class="flex flex-wrap items-start gap-2"
        @submit="createList(section.type, $event)"
      >
        <UFormField name="name" class="min-w-48 flex-1">
          <UInput
            v-model="forms[section.type].name"
            :placeholder="section.placeholder"
            aria-label="Új lista neve"
            class="w-full"
          />
        </UFormField>
        <USelect
          v-if="multipleHouseholds"
          v-model="forms[section.type].householdId"
          :items="householdOptions"
          aria-label="Háztartás"
          class="w-40"
        />
        <UButton type="submit" icon="i-lucide-plus" label="Új lista" />
      </UForm>
    </section>
  </div>
</template>
