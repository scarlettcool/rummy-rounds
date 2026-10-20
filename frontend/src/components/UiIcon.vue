<script setup lang="ts">
defineProps<{ name: 'home' | 'cards' | 'help' | 'arrow' | 'refresh' | 'sort' | 'check' | 'close' | 'cloud' }>()
const paths = {
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  cards: 'M9 3h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM3 7v13a2 2 0 0 0 2 2h10M11 8h6m-6 4h4',
  help: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4m0 3h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  refresh: 'M20 8a8 8 0 1 0 0 8M20 3v5h-5',
  sort: 'M7 3v18m-4-4 4 4 4-4M14 5h7m-7 6h5m-5 6h3',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  cloud: 'M6 18a4 4 0 0 1-1-7.9 7 7 0 0 1 13.5-2A5 5 0 0 1 18 18Z',
}
</script>

<template>
  <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name]" /></svg>
</template>
