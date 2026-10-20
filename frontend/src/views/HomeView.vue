<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import GameCard from '../components/GameCard.vue'
import UiIcon from '../components/UiIcon.vue'
import GameHelp from '../components/GameHelp.vue'
import { checkHealth, createRoom } from '../game/api'
import { lastRoom, rememberRoom, type Card } from '../game/room'

const router = useRouter()
const service = ref<'checking' | 'online' | 'offline'>('checking')
const joining = ref(false)
const error = ref('')
const recent = ref<string | null>(lastRoom())
const showcase: Card[] = [
  { id: 'art-1', color: 'blue', value: '7' },
  { id: 'art-2', color: 'red', value: '8' },
  { id: 'art-3', color: 'green', value: '9' },
]

let healthGeneration = 0
let disposed = false
async function refreshService() {
  const generation = ++healthGeneration
  service.value = 'checking'
  const online = await checkHealth()
  if (!disposed && generation === healthGeneration) service.value = online ? 'online' : 'offline'
}
onMounted(refreshService)
onUnmounted(() => { disposed = true; healthGeneration++ })

async function startRoom(mode: 'practice' | 'challenge' = 'practice') {
  if (joining.value) return
  healthGeneration++
  joining.value = true
  error.value = ''
  try {
    const state = await createRoom(mode)
    if (disposed) return
    service.value = 'online'
    rememberRoom(state.id)
    recent.value = state.id
    await router.push({ name: 'rummy', query: { room: state.id } })
  } catch (e) {
    if (disposed) return
    error.value = e instanceof Error ? e.message : '暂时无法创建房间。'
    void refreshService()
  } finally { joining.value = false }
}
function practice() {
  if (!joining.value) router.push({ name: 'rummy', query: { room: 'practice' } })
}
</script>

<template>
  <main class="lobby-shell">
    <header class="club-header page-width">
      <a class="brand" href="/" aria-label="牌友 Rummy 大厅"><span class="brand-emblem" aria-hidden="true">R</span><span>牌友<span class="brand-caption">RUMMY CLUB</span></span></a>
      <nav class="desktop-nav" aria-label="主导航"><span class="nav-current">游戏大厅</span><GameHelp /></nav>
      <div class="guest-profile"><span class="guest-avatar">C</span><span><b>Cloud Player</b><small>访客 · 单人模式</small></span></div>
    </header>
    <div class="lobby-toolbar page-width"><span role="status" data-testid="lobby-service"><i class="status-dot" :class="{ connected: service === 'online' }" aria-hidden="true"></i>{{ service === 'checking' ? '正在连接…' : service === 'online' ? '牌桌服务在线' : '离线练习可用' }}</span><button v-if="service !== 'online'" class="text-button" data-testid="retry-connection" :disabled="service === 'checking' || joining" @click="refreshService">{{ service === 'checking' ? '连接中…' : '重试连接' }}<UiIcon name="refresh" /></button><span v-else class="quiet-label">轻松入门 · 随时开局</span></div>

    <div v-if="error" class="notice error page-width" role="alert">{{ error }}<button class="text-button" :disabled="joining" @click="practice">进入离线练习<UiIcon name="arrow" /></button></div>

    <section class="lobby-hero page-width" aria-labelledby="lobby-title">
      <div class="hero-copy">
        <span class="eyebrow"><span class="short-line"></span> THE CARD ROOM</span>
        <h1 id="lobby-title">Rummy<span>你的专属牌桌。</span></h1>
        <p>凑齐两组三张同点数字牌，完成你的第一场挑战。</p>
        <div class="hero-actions"><button class="primary-button large" :disabled="joining" data-testid="start-challenge" @click="startRoom('challenge')">{{ joining ? '正在准备牌桌…' : '开始组牌挑战' }}<UiIcon name="arrow" /></button><button class="text-button" :disabled="joining" @click="practice">先离线练习</button></div>
        <div class="hero-details"><span><UiIcon name="check" />单人组牌挑战</span><span><UiIcon name="cloud" />进度与结果自动保存</span></div>
      </div>
      <div class="hero-art" aria-hidden="true"><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><span class="art-watermark">R</span><div class="showcase-hand"><GameCard v-for="card in showcase" :key="card.id" :card="card" disabled /></div><div class="art-caption"><span>01 — THE CLASSICS</span><b>ONE MORE ROUND.</b></div></div>
    </section>

    <section class="room-section page-width" aria-labelledby="room-title">
      <div class="section-heading"><div><span class="eyebrow">TAKE YOUR SEAT</span><h2 id="room-title">选择你的牌桌</h2></div><span class="section-aside">单人游玩，无需筹码</span></div>
      <div class="room-options">
        <button class="room-option" :disabled="joining" data-testid="start-room" @click="startRoom('practice')"><span class="option-icon"><UiIcon name="cards" /></span><span class="option-copy"><b>经典练习桌</b><small>自由摸弃 · 在线保存 · 刷新可继续</small></span><span class="option-action">开局<UiIcon name="arrow" /></span></button>
        <button class="room-option" :disabled="joining" @click="practice"><span class="option-icon outlined"><UiIcon name="home" /></span><span class="option-copy"><b>自由练习桌</b><small>无需连接 · 即开即玩 · 离开后不保存</small></span><span class="option-action">练习<UiIcon name="arrow" /></span></button>
        <button v-if="recent" class="room-option recent-option" :disabled="joining" data-testid="resume-room" @click="router.push({ name: 'rummy', query: { room: recent } })"><span class="option-icon outlined"><UiIcon name="refresh" /></span><span class="option-copy"><b>继续上次牌局</b><small>回到最近的在线牌桌或查看已完成结果</small></span><span class="option-action">继续<UiIcon name="arrow" /></span></button>
      </div>
    </section>
    <section class="lobby-footnote page-width"><div><span class="tiny-card-mark">R</span><span>108 张牌，四种色彩。<small>从简单的一轮开始。</small></span></div><GameHelp /></section>
    <footer class="club-footer page-width"><span>牌友 RUMMY CLUB</span><span>单人挑战与练习 · 多人对局筹备中</span></footer>
    <nav class="mobile-nav" aria-label="底部导航"><a href="/" aria-current="page"><UiIcon name="home" />大厅</a><button :disabled="joining" @click="practice"><UiIcon name="cards" />练习</button><GameHelp /></nav>
  </main>
</template>
