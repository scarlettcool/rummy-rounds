import { afterEach, describe, expect, it, vi } from 'vitest'
import { challengeGroups } from '@rules/challenge'
import { isRoomState, practiceRoom, type RoomState } from '../room'
import { createRoom } from '../api'

afterEach(() => vi.unstubAllGlobals())

describe('challenge response validation', () => {
  it('accepts legacy practice states and rejects unknown goal formats', () => {
    const state = practiceRoom().state
    expect(isRoomState(state)).toBe(true)
    expect(isRoomState({ ...state, challenge: { goal: 'unknown', status: 'active' } })).toBe(false)
    expect(isRoomState({ ...state, challenge: null })).toBe(false)
  })

  it('validates a completed result against the actual hand and revision', () => {
    const state: RoomState = practiceRoom().state
    state.player.hand = [1, 1, 1, 2, 2, 2, 3, 4, 5, 6].map((value, i) => ({ id: `proof-${i}`, color: 'red', value: String(value) }))
    const challenge = { goal: 'two-sets', status: 'completed', groups: challengeGroups(state.player.hand), completedAt: 100, turnsPlayed: 0 }
    expect(isRoomState({ ...state, challenge, revision: 1 })).toBe(true)
    expect(isRoomState({ ...state, challenge, revision: 0 })).toBe(false)
    expect(isRoomState({ ...state, challenge: { ...challenge, groups: [challenge.groups[0], challenge.groups[0]] }, revision: 1 })).toBe(false)
  })

  it('rejects a practice room returned by an older backend for a challenge request', async () => {
    const state = practiceRoom().state
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: state.id, state }), { status: 201 })))
    await expect(createRoom('challenge')).rejects.toThrow('牌桌模式不匹配')
  })

  it('accepts a challenge only when its response matches the requested mode', async () => {
    const state: RoomState = { ...practiceRoom().state, challenge: { goal: 'two-sets', status: 'active' } }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: state.id, state }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(createRoom('challenge')).resolves.toEqual(state)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ mode: 'challenge' })
  })
})
