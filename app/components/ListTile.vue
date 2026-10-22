<script setup lang="ts">
const props = defineProps<{
  to: string
  name: string
  openCount: number
  doneCount: number
  household?: string
  active?: boolean
  compact?: boolean
}>()

const total = computed(() => props.openCount + props.doneCount)
const progress = computed(() => (total.value ? Math.round((props.doneCount / total.value) * 100) : 0))
const summary = computed(() => {
  if (!total.value) return 'üres'
  if (!props.openCount) return 'minden kész'
  return `${props.openCount} nyitott${props.doneCount ? ` · ${props.doneCount} kész` : ''}`
})
</script>

<template>
  <NuxtLink
    :to="to"
    class="group flex flex-col rounded-xl border bg-default transition hover:border-primary/60 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-primary"
    :class="[
      active ? 'border-primary ring-1 ring-primary' : 'border-default',
      compact ? 'gap-1.5 p-3' : 'gap-3 p-4',
    ]"
    :aria-current="active ? 'page' : undefined"
  >
    <div class="flex items-start justify-between gap-2">
      <span class="min-w-0 font-medium" :class="compact ? 'truncate' : 'line-clamp-2 hyphens-auto break-words sm:text-lg'">{{ name }}</span>
      <span
        v-if="!compact && openCount"
        class="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-sm font-semibold text-primary"
      >{{ openCount }}</span>
    </div>
    <div class="h-1.5 overflow-hidden rounded-full bg-elevated">
      <div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${progress}%` }" />
    </div>
    <div class="flex items-center justify-between gap-2 text-sm text-muted">
      <span class="truncate">{{ summary }}</span>
      <span v-if="household" class="truncate text-xs">{{ household }}</span>
    </div>
  </NuxtLink>
</template>
