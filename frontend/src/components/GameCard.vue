<script setup lang="ts">
import { cardLabel, cardValue, type Card } from '../game/room'
defineProps<{ card: Card; selected?: boolean; disabled?: boolean }>()
defineEmits<{ select: [] }>()
</script>

<template>
  <button type="button" class="game-card" :class="[card.color, { selected }]" :disabled="disabled"
    :aria-label="cardLabel(card)" :aria-pressed="selected ?? false" @click="$emit('select')">
    <span class="card-corner">{{ cardValue(card) }}<i aria-hidden="true">●</i></span>
    <strong class="card-value">{{ cardValue(card) }}</strong>
    <span class="card-corner card-bottom" aria-hidden="true">{{ cardValue(card) }}<i>●</i></span>
  </button>
</template>
