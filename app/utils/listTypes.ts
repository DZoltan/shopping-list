import type { ListType } from '#shared/constants'

// UI texts and icons per list type; also drives the tabs in the header
export const LIST_TYPE_META: Record<ListType, {
  tab: string
  icon: string
  newListPlaceholder: string
  itemPlaceholder: string
  emptyText: string
}> = {
  shopping: {
    tab: 'Bevásárlás',
    icon: 'i-lucide-shopping-cart',
    newListPlaceholder: 'pl. Heti nagybevásárlás',
    itemPlaceholder: 'Mit kell venni?',
    emptyText: 'Még nincs bevásárlólistád.',
  },
  todo: {
    tab: 'Teendők',
    icon: 'i-lucide-list-checks',
    newListPlaceholder: 'pl. Ház körül',
    itemPlaceholder: 'Mit kell csinálni?',
    emptyText: 'Még nincs teendőlistád.',
  },
}
