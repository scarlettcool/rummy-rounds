import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import HomeView from '../HomeView.vue'
import { ApiError, checkHealth, createRoom } from '../../game/api'
import { practiceRoom } from '../../game/room'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('../../game/api', async () => {
  const actual = await vi.importActual<typeof import('../../game/api')>('../../game/api')
  return { ...actual, checkHealth: vi.fn(), createRoom: vi.fn() }
})
let wrapper: VueWrapper
beforeEach(() => { vi.clearAllMocks(); vi.mocked(checkHealth).mockResolvedValue(true) })
afterEach(() => wrapper?.unmount())

describe('lobby game entries', () => {
  it('creates the selected challenge or practice mode explicitly', async () => {
    const state = { ...practiceRoom().state, id: 'room-created' }
    vi.mocked(createRoom).mockResolvedValue(state)
    wrapper = mount(HomeView)
    await wrapper.get('[data-testid="start-challenge"]').trigger('click')
    await flushPromises()
    expect(createRoom).toHaveBeenLastCalledWith('challenge')
    expect(push).toHaveBeenCalledWith({ name: 'rummy', query: { room: state.id } })
    await wrapper.get('[data-testid="start-room"]').trigger('click')
    await flushPromises()
    expect(createRoom).toHaveBeenLastCalledWith('practice')
  })

  it('prevents duplicate room creation and does not navigate on a failed create', async () => {
    let reject!: (reason: Error) => void
    vi.mocked(createRoom).mockReturnValue(new Promise((_, fail) => { reject = fail }))
    wrapper = mount(HomeView)
    const start = wrapper.get('[data-testid="start-challenge"]')
    await start.trigger('click')
    await start.trigger('click')
    expect(createRoom).toHaveBeenCalledTimes(1)
    reject(new ApiError('暂时无法创建牌局', 503))
    await flushPromises()
    expect(push).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('暂时无法创建牌局')
    expect(start.attributes('disabled')).toBeUndefined()
  })
})
