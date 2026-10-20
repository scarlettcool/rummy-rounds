import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import RummyView from '../RummyView.vue'
import { ApiError, readRoom, roomAction } from '../../game/api'
import { practiceRoom } from '../../game/room'

const route = reactive({ query: { room: 'room-test' } })
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../../game/api', async () => {
  const actual = await vi.importActual<typeof import('../../game/api')>('../../game/api')
  return { ...actual, readRoom: vi.fn(), roomAction: vi.fn() }
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
})
