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

  it('retries a failed connection without creating a room or repeating a pending probe', async () => {
    let resolveHealth!: (online: boolean) => void
    vi.mocked(checkHealth).mockResolvedValueOnce(false)
    wrapper = mount(HomeView)
    await flushPromises()
    expect(wrapper.get('[data-testid="lobby-service"]').text()).toContain('离线练习可用')
    vi.mocked(checkHealth).mockReturnValueOnce(new Promise(resolve => { resolveHealth = resolve }))
    const retry = wrapper.get('[data-testid="retry-connection"]')
    await retry.trigger('click')
    await retry.trigger('click')
    expect(checkHealth).toHaveBeenCalledTimes(2)
    expect(retry.attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="lobby-service"]').text()).toContain('正在连接')
    resolveHealth(true)
    await flushPromises()
    expect(wrapper.get('[data-testid="lobby-service"]').text()).toContain('牌桌服务在线')
    expect(wrapper.find('[data-testid="retry-connection"]').exists()).toBe(false)
    expect(createRoom).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('checks actual availability after a rejected create instead of claiming offline', async () => {
    vi.mocked(createRoom).mockRejectedValue(new ApiError('暂时无法创建牌局', 503))
    wrapper = mount(HomeView)
    await flushPromises()
    await wrapper.get('[data-testid="start-challenge"]').trigger('click')
    await flushPromises()
    expect(checkHealth).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[data-testid="lobby-service"]').text()).toContain('牌桌服务在线')
    expect(wrapper.get('[role="alert"]').text()).toContain('暂时无法创建牌局')
    expect(push).not.toHaveBeenCalled()
  })

  it('does not let an old health response overwrite a successful room creation', async () => {
    let resolveHealth!: (online: boolean) => void
    vi.mocked(checkHealth).mockReturnValueOnce(new Promise(resolve => { resolveHealth = resolve }))
    vi.mocked(createRoom).mockResolvedValue({ ...practiceRoom().state, id: 'room-online' })
    wrapper = mount(HomeView)
    await wrapper.get('[data-testid="start-room"]').trigger('click')
    await flushPromises()
    resolveHealth(false)
    await flushPromises()
    expect(wrapper.get('[data-testid="lobby-service"]').text()).toContain('牌桌服务在线')
    expect(push).toHaveBeenCalledOnce()
  })

  it('does not navigate after leaving the lobby with creation still pending', async () => {
    let resolveRoom!: (state: ReturnType<typeof practiceRoom>['state']) => void
    vi.mocked(createRoom).mockReturnValueOnce(new Promise(resolve => { resolveRoom = resolve }))
    wrapper = mount(HomeView)
    await wrapper.get('[data-testid="start-room"]').trigger('click')
    wrapper.unmount()
    resolveRoom({ ...practiceRoom().state, id: 'room-late' })
    await flushPromises()
    expect(push).not.toHaveBeenCalled()
  })
})
