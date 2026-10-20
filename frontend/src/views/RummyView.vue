<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GameCard from '../components/GameCard.vue'
import UiIcon from '../components/UiIcon.vue'
import GameHelp from '../components/GameHelp.vue'
import { ApiError, readRoom, roomAction } from '../game/api'
import { cardLabel, practiceRoom, rememberRoom, shuffled, type RoomState } from '../game/room'
import { analyzeHand } from '../game/handAnalysis'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => String(route.query.room ?? 'practice'))
const offline = computed(() => ['practice', 'offline-room', 'demo-room'].includes(roomId.value))
const state = ref<RoomState | null>(null)
const loading = ref(false)
const busy = ref(false)
const blocked = ref(false)
const error = ref('')
const selectedId = ref<string | null>(null)
const sortBy = ref<'dealt' | 'number' | 'color'>('dealt')
const lastDrawnId = ref('')
const activeGroup = ref<number | null>(null)
let practice = practiceRoom()
let generation = 0

const hand = computed(() => {
  const cards = [...(state.value?.player.hand ?? [])]
  if (sortBy.value === 'number') cards.sort((a, b) => (Number(a.value) || 99) - (Number(b.value) || 99))
  if (sortBy.value === 'color') cards.sort((a, b) => a.color.localeCompare(b.color) || (Number(a.value) || 99) - (Number(b.value) || 99))
  return cards
})
const unavailable = computed(() => loading.value || busy.value || blocked.value || !state.value)
const analysis = computed(() => analyzeHand(state.value?.player.hand ?? []))
const highlightedIds = computed(() => new Set(
  activeGroup.value === null ? [] : analysis.value.groups[activeGroup.value]?.cards.map(c => c.id) ?? [],
))
const hint = computed(() => {
  if (loading.value) return '正在准备你的牌桌…'
  if (blocked.value) return '重新同步后继续，当前牌局已保留'
  if (busy.value) return '正在保存这一步…'
  if (selectedId.value) return '已选中一张手牌，确认后弃牌'
  return state.value?.player.hasDrawn ? '选择一张手牌，再点击弃牌' : '从牌堆摸一张，开始本回合'
})
const selectedLabel = computed(() => {
  const card = state.value?.player.hand.find(c => c.id === selectedId.value)
  return card ? cardLabel(card) : ''
})

function apply(next: RoomState) {
  state.value = next
  selectedId.value = null
  activeGroup.value = null
  blocked.value = false
}

async function load() {
  if (busy.value || loading.value) return
  const current = ++generation
  const id = roomId.value
  error.value = ''
  selectedId.value = null
  activeGroup.value = null
  lastDrawnId.value = ''
  if (offline.value) {
    practice = practiceRoom()
    apply(practice.state)
    return
  }
  loading.value = true
  try {
    const next = await readRoom(id)
    if (current !== generation) return
    apply(next)
    rememberRoom(next.id)
  } catch (e) {
    if (current !== generation) return
    blocked.value = true
    error.value = e instanceof Error ? e.message : '无法读取牌局，请重试。'
  } finally { if (current === generation) loading.value = false }
}

function select(id: string) {
  if (unavailable.value || !state.value?.player.hasDrawn) return
  selectedId.value = selectedId.value === id ? null : id
}

async function act(action: 'draw' | 'discard') {
  const snapshot = state.value
  if (unavailable.value || !snapshot) return
  if (action === 'draw' && snapshot.player.hasDrawn) return
  if (action === 'discard' && (!snapshot.player.hasDrawn || !selectedId.value)) return
  error.value = ''
  if (offline.value) {
    const next: RoomState = { ...snapshot, player: { ...snapshot.player, hand: [...snapshot.player.hand] } }
    if (action === 'draw') {
      if (!practice.deck.length && practice.discarded.length > 1) {
        const top = practice.discarded.pop()!
        practice.deck = shuffled(practice.discarded)
        practice.discarded = [top]
      }
      const card = practice.deck.shift()
      if (!card) return
      next.player.hand.push(card)
      next.player.hasDrawn = true
      lastDrawnId.value = card.id
    } else {
      const index = next.player.hand.findIndex(c => c.id === selectedId.value)
      if (index < 0) return
      const [card] = next.player.hand.splice(index, 1)
      practice.discarded.push(card)
      next.discardPile = card
      next.player.hasDrawn = false
      next.turn += 1
      lastDrawnId.value = ''
    }
    next.drawPileCount = practice.deck.length
    next.revision += 1
    apply(next)
    return
  }
  busy.value = true
  const current = generation
  try {
    const next = await roomAction(roomId.value, action, snapshot.revision, selectedId.value ?? undefined)
    if (current !== generation) return
    apply(next)
    lastDrawnId.value = action === 'draw' ? next.player.hand[next.player.hand.length - 1]?.id ?? '' : ''
  } catch (e) {
    if (current !== generation) return
    if (e instanceof ApiError && e.status === 409 && e.state?.id === roomId.value) {
      apply(e.state)
      error.value = e.message
    } else {
      blocked.value = true
      error.value = e instanceof Error ? e.message : '操作未完成，请重新同步。'
    }
  } finally { if (current === generation) busy.value = false }
}

function cycleSort() {
  sortBy.value = sortBy.value === 'dealt' ? 'number' : sortBy.value === 'number' ? 'color' : 'dealt'
}

watch(roomId, () => {
  generation += 1
  loading.value = false
  busy.value = false
  state.value = null
  blocked.value = false
  sortBy.value = 'dealt'
  void load()
}, { immediate: true })

const renderGameToText = () => JSON.stringify({
  mode: offline.value ? 'practice' : 'saved-practice', room: roomId.value,
  handSize: state.value?.player.hand.length ?? 0,
  hand: hand.value, drawPile: state.value?.drawPileCount ?? 0,
  discard: state.value?.discardPile, hasDrawn: state.value?.player.hasDrawn ?? false,
  turn: state.value?.turn ?? 1, revision: state.value?.revision ?? 0,
  selectedId: selectedId.value, loading: loading.value, busy: busy.value, blocked: blocked.value,
  suggestions: analysis.value.groups, coveredCards: analysis.value.covered,
  highlightedIds: [...highlightedIds.value],
})
const advanceTime = (_ms: number) => undefined
Object.assign(window, { render_game_to_text: renderGameToText, advanceTime })
onBeforeUnmount(() => {
  generation += 1
  const hooks = window as typeof window & { render_game_to_text?: unknown; advanceTime?: unknown }
  if (hooks.render_game_to_text === renderGameToText) delete hooks.render_game_to_text
  if (hooks.advanceTime === advanceTime) delete hooks.advanceTime
})
</script>

<template>
  <main class="table-shell">
    <header class="table-header page-width">
      <button class="back-button" @click="router.push('/')"><UiIcon name="arrow" />返回大厅</button>
      <div class="table-title"><span class="eyebrow">RUMMY CLUB</span><h1>经典练习桌</h1></div>
      <GameHelp />
    </header>
    <div class="table-toolbar page-width"><span><i class="status-dot" :class="{ connected: !offline && !blocked && !loading }"></i>{{ loading ? '正在同步' : offline ? '离线练习 · 本次不保存' : blocked ? '等待重新同步' : '在线练习 · 自动保存' }}</span><button v-if="!offline" class="text-button" :disabled="busy || loading" @click="load"><UiIcon name="refresh" />重新同步</button><span v-else class="quiet-label">单人模式</span></div>
    <div v-if="error" class="notice error page-width" role="alert"><span>{{ error }}</span><button class="text-button" :disabled="busy || loading" @click="load">重新同步<UiIcon name="refresh" /></button></div>

    <section class="table-stage page-width" aria-label="练习牌桌">
      <div class="felt-lines" aria-hidden="true"></div>
      <div class="table-stamp" aria-hidden="true"><span>R</span><small>RUMMY CLUB</small></div>
      <div class="table-round"><span class="eyebrow">PRACTICE TABLE</span><b>第 {{ state?.turn ?? 1 }} 回合</b></div>
      <div class="practice-label"><span class="tiny-diamond"></span>单人操作练习</div>
      <div class="pile-area">
        <div class="pile-group"><button class="deck-stack" aria-label="从牌堆摸一张牌" :disabled="unavailable || state?.player.hasDrawn" @click="act('draw')"><span class="deck-pattern"><span>R</span><small>RUMMY CLUB</small></span></button><span class="pile-caption">摸牌堆 <b>{{ state?.drawPileCount ?? '—' }}</b></span></div>
        <span class="pile-divider" aria-hidden="true"></span>
        <div class="pile-group"><GameCard v-if="state?.discardPile" :card="state.discardPile" disabled /><span v-else class="empty-card">等待发牌</span><span class="pile-caption">弃牌堆</span></div>
      </div>
      <div class="table-coach" role="status" aria-live="polite"><span class="turn-indicator" :class="{ paused: unavailable }"></span>{{ hint }}</div>
      <span class="table-edge-note">DRAW · SELECT · DISCARD</span>
    </section>

    <section class="hand-panel page-width" aria-label="你的手牌">
      <div class="hand-header"><div class="player-chip"><span class="player-avatar">C</span><span><b>你的手牌 <span class="hand-count" data-testid="hand-count">{{ hand.length }}</span></b><small>{{ state?.player.hasDrawn ? '已摸牌，选择一张弃掉' : '准备好就开始这一回合' }}</small></span></div><button class="sort-button" :disabled="unavailable" @click="cycleSort"><UiIcon name="sort" />{{ sortBy === 'number' ? '按数字' : sortBy === 'color' ? '按颜色' : '理牌' }}</button></div>
      <TransitionGroup tag="div" name="hand-card" class="hand-row" :style="{ '--hand-count': Math.max(hand.length, 1) }">
        <div v-for="card in hand" :key="card.id" class="hand-slot" :class="{ 'is-selected': selectedId === card.id, 'just-drawn': lastDrawnId === card.id, 'in-suggestion': highlightedIds.has(card.id) }"><GameCard :card="card" :selected="selectedId === card.id" :disabled="unavailable || !state?.player.hasDrawn" @select="select(card.id)" /></div>
      </TransitionGroup>
      <div class="hand-insight" aria-label="组合参考">
        <span class="insight-title">组合参考<small>仅数字牌</small></span>
        <div class="insight-groups">
          <span v-if="!analysis.groups.length" class="insight-empty">{{ unavailable ? '同步完成后查看' : '暂无组合 · 同点 3 张起，连号 4 张起' }}</span>
          <button v-for="(group, index) in analysis.groups" :key="index" class="insight-group" :disabled="unavailable" :aria-pressed="activeGroup === index" :aria-label="`${group.label}，点击高亮对应手牌`" @click="activeGroup = activeGroup === index ? null : index">{{ group.label }}</button>
        </div>
        <span v-if="analysis.covered" class="insight-coverage" role="status">{{ analysis.covered }}/{{ hand.length }} 张</span>
      </div>
      <div class="hand-actions"><div class="action-caption" aria-live="polite"><span class="eyebrow">{{ selectedId ? 'SELECTED CARD' : 'YOUR TURN' }}</span><b>{{ selectedId ? selectedLabel : state?.player.hasDrawn ? '选择一张手牌' : '先摸一张牌' }}</b></div><div class="action-buttons"><button class="secondary-button" data-testid="draw-card" :disabled="unavailable || state?.player.hasDrawn" @click="act('draw')"><UiIcon name="cards" />{{ busy && !state?.player.hasDrawn ? '保存中…' : '摸牌' }}</button><button class="primary-button" data-testid="discard-card" :disabled="unavailable || !state?.player.hasDrawn || !selectedId" @click="act('discard')">{{ busy && state?.player.hasDrawn ? '保存中…' : '弃牌' }}<UiIcon name="arrow" /></button></div></div>
    </section>
    <footer class="table-footer page-width"><span>组合提示仅供参考 · 组牌提交、特殊牌效果与计分尚未开放</span><span v-if="!offline">进度在服务端保存</span></footer>
  </main>
</template>
