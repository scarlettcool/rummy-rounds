import { isRoomState, type RoomState } from './room'

const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message: string, public status = 0, public state?: RoomState) { super(message) }
}

async function request(path: string, body?: object): Promise<unknown> {
  try {
    const response = await fetch(`${base}/api${path}`, {
      method: body ? 'POST' : 'GET',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(8000),
    })
    const result = await response.json()
    if (!response.ok) throw new ApiError(
      typeof result.message === 'string' ? result.message : '操作未完成，请重新同步。',
      response.status, isRoomState(result.state) ? result.state : undefined,
    )
    return result
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('暂时无法连接，牌局已保留。请重新同步后继续。')
  }
}

function validated(value: unknown, id?: string) {
  if (!isRoomState(value) || (id && value.id !== id)) throw new ApiError('牌局数据不完整，请重新同步。')
  return value
}

export async function createRoom() {
  const result = await request('/games', {}) as { id?: string; state?: unknown }
  const state = validated(result.state)
  if (result.id !== state.id) throw new ApiError('房间数据不一致，请重试。')
  return state
}
export async function readRoom(id: string) {
  return validated(await request(`/games/${encodeURIComponent(id)}`), id)
}
export async function roomAction(id: string, action: 'draw' | 'discard', revision: number, cardId?: string) {
  return validated(await request(`/games/${encodeURIComponent(id)}/${action}`, { expectedRevision: revision, cardId }), id)
}
export async function checkHealth() {
  try {
    const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(3000) })
    return response.ok
  } catch { return false }
}
