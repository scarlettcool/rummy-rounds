import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import RummyView from '../RummyView.vue'
import { ApiError, createRoom, readRoom, roomAction } from '../../game/api'
import { practiceRoom, type CardColor, type RoomState } from '../../game/room'
import { challengeGroups } from '@rules/challenge'

const route = reactive({ query: { room: 'room-test' } })
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ push }) }))
vi.mock('../../game/api', async () => {
  const actual = await vi.importActual<typeof import('../../game/api')>('../../game/api')
  return { ...actual, createRoom: vi.fn(), readRoom: vi.fn(), roomAction: vi.fn() }
})

function challengeFixture(completed = false): RoomState {
  const state = fixture()
  const colors: CardColor[] = ['red', 'yellow', 'green', 'blue']
  state.player.hand = [1, 1, 1, 2, 2, 2, 3, 4, 5, 6].map((value, i) => ({ id: `goal-${i}`, color: colors[i % 4], value: String(value) }))
  state.challenge = completed
    ? { goal: 'two-sets', status: 'completed', groups: challengeGroups(state.player.hand), completedAt: 12345, turnsPlayed: 0 }
    : { goal: 'two-sets', status: 'active' }
  if (completed) state.revision = 1
  return state
}

describe('challenge completion and replay', () => {
  it('does not confuse a long run with the required two sets', async () => {
    const state = challengeFixture()
    state.player.hand = Array.from({ length: 10 }, (_, i) => ({ id: `run-${i}`, color: 'red', value: String(i + 1) }))
    vi.mocked(readRoom).mockResolvedValue(state)
    await open()
    expect(textState().coveredCards).toBe(10)
    expect(textState().suggestions).toEqual([])
    expect(wrapper.get('[data-testid="complete-challenge"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="draw-card"]').attributes('disabled')).toBeUndefined()
  })

  it('submits once and shows a result only after the saved server response', async () => {
    vi.mocked(readRoom).mockResolvedValue(challengeFixture())
    await open()
    let resolve!: (state: RoomState) => void
    vi.mocked(roomAction).mockReturnValue(new Promise(done => { resolve = done }))
    const submit = wrapper.get('[data-testid="complete-challenge"]')
    await submit.trigger('click')
    await submit.trigger('click')
    expect(roomAction).toHaveBeenCalledTimes(1)
    expect(roomAction).toHaveBeenCalledWith('room-test', 'complete', 0, undefined)
    expect(wrapper.find('.challenge-result').exists()).toBe(false)
    resolve(challengeFixture(true))
    await flushPromises()
    expect(wrapper.get('.challenge-result').text()).toContain('挑战完成')
    expect(wrapper.findAll('.result-group .game-card')).toHaveLength(6)
    expect(wrapper.find('[data-testid="draw-card"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="discard-card"]').exists()).toBe(false)
    expect(wrapper.findAll('.hand-row .game-card').every(card => card.attributes('disabled') !== undefined)).toBe(true)
  })

  it('blocks on a lost completion response and restores the canonical result by syncing', async () => {
    vi.mocked(readRoom).mockResolvedValue(challengeFixture())
    await open()
    vi.mocked(roomAction).mockRejectedValue(new ApiError('保存连接中断', 503))
    await wrapper.get('[data-testid="complete-challenge"]').trigger('click')
    await flushPromises()
    expect(textState().blocked).toBe(true)
    expect(wrapper.find('.challenge-result').exists()).toBe(false)
    vi.mocked(readRoom).mockResolvedValue(challengeFixture(true))
    await wrapper.get('.notice button').trigger('click')
    await flushPromises()
    expect(textState().blocked).toBe(false)
    expect(wrapper.find('.challenge-result').exists()).toBe(true)
  })

  it('uses a rejected goal response without blocking subsequent play', async () => {
    vi.mocked(readRoom).mockResolvedValue(challengeFixture())
    await open()
    const changed = challengeFixture()
    changed.player.hand[0] = { id: 'replacement', color: 'red', value: '12' }
    changed.revision = 2
    vi.mocked(roomAction).mockRejectedValue(new ApiError('目标尚未完成', 422, changed))
    await wrapper.get('[data-testid="complete-challenge"]').trigger('click')
    await flushPromises()
    expect(textState().blocked).toBe(false)
    expect(textState().revision).toBe(2)
    expect(wrapper.get('[data-testid="draw-card"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="complete-challenge"]').attributes('disabled')).toBeDefined()
  })

  it('restores a result and creates the next room once without losing the existing result on failure', async () => {
    vi.mocked(readRoom).mockResolvedValue(challengeFixture(true))
    await open()
    vi.mocked(createRoom).mockRejectedValueOnce(new ApiError('下一局暂时无法创建', 503))
    await wrapper.get('[data-testid="next-challenge"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('.challenge-result').exists()).toBe(true)
    expect(textState().blocked).toBe(false)
    expect(push).not.toHaveBeenCalled()
    let resolve!: (state: RoomState) => void
    vi.mocked(createRoom).mockReturnValue(new Promise(done => { resolve = done }))
    const next = wrapper.get('[data-testid="next-challenge"]')
    await next.trigger('click')
    await next.trigger('click')
    expect(createRoom).toHaveBeenCalledTimes(2)
    resolve({ ...challengeFixture(), id: 'room-next' })
    await flushPromises()
    expect(createRoom).toHaveBeenLastCalledWith('challenge')
    expect(push).toHaveBeenCalledWith({ name: 'rummy', query: { room: 'room-next' } })
  })

  it('ignores a next-room response after leaving the completed room', async () => {
    vi.mocked(readRoom).mockResolvedValue(challengeFixture(true))
    await open()
    let resolve!: (state: RoomState) => void
    vi.mocked(createRoom).mockReturnValue(new Promise(done => { resolve = done }))
    await wrapper.get('[data-testid="next-challenge"]').trigger('click')
    route.query.room = 'practice'
    await flushPromises()
    resolve({ ...challengeFixture(), id: 'room-too-late' })
    await flushPromises()
    expect(push).not.toHaveBeenCalled()
    expect(textState().mode).toBe('practice')
  })
})
let wrapper: VueWrapper
function fixture() { return { ...practiceRoom().state, id: 'room-test' } }
beforeEach(() => {
  vi.clearAllMocks()
  route.query.room = 'room-test'
  vi.mocked(readRoom).mockResolvedValue(fixture())
})
afterEach(() => { wrapper?.unmount() })
async function open() { wrapper = mount(RummyView); await flushPromises() }
const textState = () => JSON.parse((window as unknown as { render_game_to_text: () => string }).render_game_to_text())

describe('table request safety', () => {
  it('waits for the initial state before enabling any actions', async () => {
    vi.mocked(readRoom).mockReturnValue(new Promise(() => {}))
    wrapper = mount(RummyView)
    expect(wrapper.get('[data-testid="draw-card"]').attributes('disabled')).toBeDefined()
    expect(textState().handSize).toBe(0)
  })

  it('keeps an unavailable online room blocked without creating a local game', async () => {
    vi.mocked(readRoom).mockRejectedValue(new ApiError('房间不存在', 404))
    await open()
    expect(textState().blocked).toBe(true)
    expect(textState().handSize).toBe(0)
    expect(wrapper.get('[role="alert"]').text()).toContain('房间不存在')
  })

  it('sends only one draw while the first request is pending', async () => {
    await open()
    vi.mocked(roomAction).mockReturnValue(new Promise(() => {}))
    const draw = wrapper.get('[data-testid="draw-card"]')
    await draw.trigger('click')
    await draw.trigger('click')
    expect(roomAction).toHaveBeenCalledTimes(1)
    expect(textState().handSize).toBe(10)
    expect(textState().busy).toBe(true)
  })

  it('does not fabricate a local draw after a network failure and can resynchronize', async () => {
    await open()
    vi.mocked(roomAction).mockRejectedValue(new ApiError('连接中断'))
    await wrapper.get('[data-testid="draw-card"]').trigger('click')
    await flushPromises()
    expect(textState().handSize).toBe(10)
    expect(textState().blocked).toBe(true)
    const synced = fixture()
    synced.player.hand.push(practiceRoom().deck[0])
    synced.player.hasDrawn = true
    synced.revision = 1
    vi.mocked(readRoom).mockResolvedValue(synced)
    await wrapper.get('.notice button').trigger('click')
    await flushPromises()
    expect(textState().handSize).toBe(11)
    expect(textState().blocked).toBe(false)
    expect(wrapper.get('[data-testid="draw-card"]').attributes('disabled')).toBeDefined()
  })

  it('uses the canonical state supplied after a stale-tab conflict', async () => {
    const current = fixture()
    current.revision = 4
    await open()
    vi.mocked(roomAction).mockRejectedValue(new ApiError('牌局已更新', 409, current))
    await wrapper.get('[data-testid="draw-card"]').trigger('click')
    await flushPromises()
    expect(textState().revision).toBe(4)
    expect(textState().blocked).toBe(false)
    expect(textState().handSize).toBe(10)
  })

  it('does not let a previous room response overwrite a changed route', async () => {
    let resolveOld!: (state: ReturnType<typeof fixture>) => void
    vi.mocked(readRoom).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    wrapper = mount(RummyView)
    route.query.room = 'practice'
    await flushPromises()
    resolveOld(fixture())
    await flushPromises()
    expect(textState().mode).toBe('practice')
    expect(textState().room).toBe('practice')
    expect(textState().loading).toBe(false)
  })

  it('preserves the selected card when sorting and completes an offline turn', async () => {
    route.query.room = 'practice'
    await open()
    await wrapper.get('[data-testid="draw-card"]').trigger('click')
    await wrapper.get('.hand-row .game-card').trigger('click')
    const selected = textState().selectedId
    await wrapper.get('.sort-button').trigger('click')
    expect(textState().selectedId).toBe(selected)
    await wrapper.get('[data-testid="discard-card"]').trigger('click')
    expect(textState().handSize).toBe(10)
    expect(textState().hasDrawn).toBe(false)
    expect(textState().discard.id).toBe(selected)
    expect(textState().turn).toBe(2)
    expect(roomAction).not.toHaveBeenCalled()
  })

  it('highlights suggestions without selecting a discard or sending an action, then clears on sync', async () => {
    const current = fixture()
    const colors: CardColor[] = ['red', 'yellow', 'green', 'blue']
    current.player.hand = [1, 1, 1, 2, 2, 2, 3, 4, 5, 6].map((value, i) => ({
      id: `known-${i}`, color: colors[i % 4], value: String(value),
    }))
    vi.mocked(readRoom).mockResolvedValue(current)
    await open()
    expect(textState().coveredCards).toBe(10)
    const suggestion = wrapper.findAll('.insight-group')[0]
    await suggestion.trigger('click')
    expect(suggestion.attributes('aria-pressed')).toBe('true')
    const highlighted = textState().highlightedIds
    expect(highlighted.length).toBe(3)
    expect(wrapper.findAll('.in-suggestion')).toHaveLength(3)
    expect(textState().selectedId).toBeNull()
    expect(roomAction).not.toHaveBeenCalled()
    await wrapper.get('.sort-button').trigger('click')
    expect(textState().highlightedIds).toEqual(highlighted)
    await suggestion.trigger('click')
    expect(textState().highlightedIds).toEqual([])
    await suggestion.trigger('click')
    await wrapper.get('.table-toolbar button').trigger('click')
    await flushPromises()
    expect(textState().highlightedIds).toEqual([])
    expect(current.player.hand).toHaveLength(10)
  })

  it('keeps discard selection independent of group highlighting and clears both after a turn', async () => {
    const current = fixture()
    current.player.hand = Array.from({ length: 11 }, (_, i) => ({ id: `run-${i}`, color: 'red' as const, value: String(i + 1) }))
    current.player.hasDrawn = true
    vi.mocked(readRoom).mockResolvedValue(current)
    await open()
    await wrapper.get('.hand-row .game-card').trigger('click')
    const selected = textState().selectedId
    await wrapper.get('.insight-group').trigger('click')
    expect(textState().selectedId).toBe(selected)
    expect(wrapper.get('[data-testid="discard-card"]').attributes('disabled')).toBeUndefined()
    vi.mocked(roomAction).mockResolvedValue({
      ...current, revision: 1, turn: 2,
      player: { ...current.player, hasDrawn: false, hand: current.player.hand.slice(1) },
      discardPile: current.player.hand[0],
    })
    await wrapper.get('[data-testid="discard-card"]').trigger('click')
    await flushPromises()
    expect(roomAction).toHaveBeenCalledWith('room-test', 'discard', 0, selected)
    expect(textState().selectedId).toBeNull()
    expect(textState().highlightedIds).toEqual([])
    expect(textState().coveredCards).toBe(10)
  })
})
