<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { ChallengeState } from '@rules/challenge'
import type { Card } from '../game/room'
import GameCard from './GameCard.vue'

defineProps<{ result: Extract<ChallengeState, { status: 'completed' }>; hand: Card[] }>()
const heading = ref<HTMLElement>()
onMounted(() => heading.value?.focus({ preventScroll: true }))
</script>

<template>
  <div class="challenge-result" aria-labelledby="result-title">
    <span class="eyebrow">CHALLENGE COMPLETE</span>
    <h2 id="result-title" ref="heading" tabindex="-1">两组同点，挑战完成</h2>
    <p>{{ result.turnsPlayed === 0 ? '好手气，起手牌已达成目标' : `经过 ${result.turnsPlayed} 轮摸牌与弃牌，你达成了目标` }}</p>
    <div class="result-groups" aria-label="已确认的两组数字牌">
      <div v-for="(group, index) in result.groups" :key="index" class="result-group">
        <span>第 {{ index + 1 }} 组</span>
        <GameCard v-for="id in group" :key="id" :card="hand.find(card => card.id === id)!" disabled />
      </div>
    </div>
    <small>结果已保存 · 随时可以回来查看</small>
  </div>
</template>
