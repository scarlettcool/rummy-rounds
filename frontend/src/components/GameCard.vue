<script setup lang="ts">
import { cardLabel, cardValue, type Card } from '../game/room'
defineProps<{ card: Card; selected?: boolean; disabled?: boolean }>()
defineEmits<{ select: [] }>()
</script>

<template>
  <button type="button" class="game-card" :class="[card.color, { selected }]" :disabled="disabled"
    :aria-label="cardLabel(card)" :aria-pressed="selected ?? false" @click="$emit('select')">
    <span class="card-corner">{{ card.value === 'skip' ? 'S' : cardValue(card) }}<i aria-hidden="true">●</i></span>
    <strong class="card-value"><svg v-if="card.value === 'skip'" class="skip-symbol" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="15"/><path d="M13 35 35 13"/></svg><template v-else>{{ cardValue(card) }}</template></strong>
    <span class="card-corner card-bottom" aria-hidden="true">{{ card.value === 'skip' ? 'S' : cardValue(card) }}<i>●</i></span>
  </button>
</template>
