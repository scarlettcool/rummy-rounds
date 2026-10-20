import { isChallengeState, type ChallengeState } from '@rules/challenge'

export type CardColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild'
export type Card = { id: string; color: CardColor; value: string }
export type RoomState = {
  id: string
  created: number
  revision: number
  turn: number
  drawPileCount: number
  discardPile: Card | null
  player: { id: string; name: string; hand: Card[]; hasDrawn: boolean }
  challenge?: ChallengeState
}

const colors: CardColor[] = ['red', 'yellow', 'green', 'blue', 'wild']
export const colorNames: Record<CardColor, string> = {
  red: '红色', yellow: '黄色', green: '绿色', blue: '蓝色', wild: '特殊',
}
export function cardLabel(card: Card) {
  return card.value === 'wild' ? '万能牌' : card.value === 'skip' ? '跳过牌' : `${colorNames[card.color]} ${card.value}`
}
export function cardValue(card: Card) {
  return card.value === 'wild' ? 'W' : card.value === 'skip' ? '⊘' : card.value
}

function isCard(value: unknown): value is Card {
  if (!value || typeof value !== 'object') return false
  const c = value as Card
  return typeof c.id === 'string' && colors.includes(c.color) &&
    (c.color === 'wild' ? ['wild', 'skip'].includes(c.value) : /^(?:[1-9]|1[0-2])$/.test(c.value))
}
export function isRoomState(value: unknown): value is RoomState {
  if (!value || typeof value !== 'object') return false
  const s = value as RoomState
  return typeof s.id === 'string' && Number.isFinite(s.created) &&
    Number.isSafeInteger(s.revision) && s.revision >= 0 && Number.isSafeInteger(s.turn) && s.turn > 0 &&
    Number.isInteger(s.drawPileCount) && s.drawPileCount >= 0 && s.drawPileCount <= 97 &&
    !!s.player && typeof s.player.hasDrawn === 'boolean' && Array.isArray(s.player.hand) &&
    s.player.hand.length === (s.player.hasDrawn ? 11 : 10) && s.player.hand.every(isCard) &&
    new Set(s.player.hand.map(c => c.id)).size === s.player.hand.length && isCard(s.discardPile) &&
    (s.challenge === undefined || (isChallengeState(s.challenge, s.player.hand, s.player.hasDrawn, s.turn) &&
      (s.challenge.status !== 'completed' || s.revision > 0)))
}

export function shuffled<T>(cards: T[]): T[] {
  const result = [...cards]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function practiceRoom() {
  const cards: Card[] = []
  for (const color of colors.filter(c => c !== 'wild')) {
    for (let value = 1; value <= 12; value++) {
      for (let copy = 0; copy < 2; copy++) cards.push({ id: `${color}-${value}-${copy}`, color, value: String(value) })
    }
  }
  for (let i = 0; i < 8; i++) cards.push({ id: `wild-wild-${i}`, color: 'wild', value: 'wild' })
  for (let i = 0; i < 4; i++) cards.push({ id: `wild-skip-${i}`, color: 'wild', value: 'skip' })
  const deck = shuffled(cards)
  const hand = deck.splice(0, 10)
  const discarded = [deck.shift()!]
  const state: RoomState = {
    id: 'practice', created: Date.now(), revision: 0, turn: 1, drawPileCount: deck.length,
    discardPile: discarded[0], player: { id: 'local-player', name: '你', hand, hasDrawn: false },
  }
  return { state, deck, discarded }
}

export function rememberRoom(id: string) {
  try { localStorage.setItem('rummy:last-room', id) } catch { /* Storage may be unavailable in private mode. */ }
}
export function lastRoom() {
  try { return localStorage.getItem('rummy:last-room') } catch { return null }
}
