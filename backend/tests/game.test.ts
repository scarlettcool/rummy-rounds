import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Request, Response } from 'express';
import { createGameController } from '../src/controllers/game';
import { FileRoomRepository, newRoom, roomView } from '../src/game/rooms';

type View = ReturnType<typeof roomView>;
type Reply = View & { id: string; state: View; message: string };
type Controller = ReturnType<typeof createGameController>;
function call(controller: Controller, action: keyof Controller, id?: string, body?: object) {
  const result = { status: 200, body: undefined as unknown as Reply };
  const response = {
    status(code: number) { result.status = code; return this; },
    send(value: unknown) { result.body = structuredClone(value) as Reply; return this; },
  } as unknown as Response;
  controller[action]({ params: { id }, body } as unknown as Request, response);
  return result;
}

let directory: string;
let repository: FileRoomRepository;
let controller: Controller;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'rummy-rooms-'));
  repository = new FileRoomRepository(directory);
  controller = createGameController(repository);
});
afterEach(() => { vi.restoreAllMocks(); rmSync(directory, { recursive: true, force: true }); });

function create() {
  const result = call(controller, 'create');
  expect(result.status).toBe(201);
  return result.body.state;
}

describe('saved practice rooms', () => {
  it('deals the complete deck without exposing hidden cards', () => {
    const state = create();
    expect(state.player.hand).toHaveLength(10);
    expect(state.drawPileCount).toBe(97);
    expect(state).not.toHaveProperty('drawPile');
    expect(state).not.toHaveProperty('players');
    expect(state.turn).toBe(1);
    expect(call(controller, 'info', state.id).body).toEqual(state);
  });

  it('preserves an unfinished turn across a repository/server restart', () => {
    const state = create();
    const drawn = call(controller, 'draw', state.id, { expectedRevision: 0 });
    expect(drawn.body.player.hand).toHaveLength(11);
    const restarted = createGameController(new FileRoomRepository(directory));
    expect(call(restarted, 'info', state.id).body).toEqual(drawn.body);
    const card = drawn.body.player.hand.at(-1)!;
    const discarded = call(restarted, 'discard', state.id, { expectedRevision: 1, cardId: card.id });
    expect(discarded.status).toBe(200);
    expect(discarded.body.player.hand).toHaveLength(10);
    expect(discarded.body.player.hasDrawn).toBe(false);
    expect(discarded.body.discardPile).toEqual(card);
    expect(discarded.body.turn).toBe(2);
    expect(discarded.body.revision).toBe(2);
  });

  it('rejects a repeated draw and a stale-tab discard without losing cards', () => {
    const state = create();
    const drawn = call(controller, 'draw', state.id, { expectedRevision: 0 }).body;
    expect(call(controller, 'draw', state.id, { expectedRevision: 0 }).status).toBe(409);
    expect(call(controller, 'draw', state.id, { expectedRevision: 1 }).status).toBe(409);
    const stale = call(controller, 'discard', state.id, { expectedRevision: 0, cardId: drawn.player.hand[0].id });
    expect(stale.status).toBe(409);
    expect(stale.body.state).toEqual(drawn);
    expect(call(controller, 'info', state.id).body).toEqual(drawn);
  });

  it('validates actions without mutating the saved hand', () => {
    const state = create();
    expect(call(controller, 'draw', state.id, {}).status).toBe(400);
    expect(call(controller, 'draw', state.id, { expectedRevision: -1 }).status).toBe(400);
    expect(call(controller, 'discard', state.id, { expectedRevision: 0, cardId: state.player.hand[0].id }).status).toBe(409);
    const drawn = call(controller, 'draw', state.id, { expectedRevision: 0 }).body;
    expect(call(controller, 'discard', state.id, { expectedRevision: 1 }).status).toBe(400);
    expect(call(controller, 'discard', state.id, { expectedRevision: 1, cardId: 'not-in-hand' }).status).toBe(400);
    expect(call(controller, 'info', state.id).body).toEqual(drawn);
  });

  it('recycles discards when the draw pile is empty and keeps every card exactly once', () => {
    const room = newRoom();
    room.discardPile.push(...room.drawPile);
    room.drawPile = [];
    const top = room.discardPile.at(-1)!;
    repository.write(room);
    const result = call(controller, 'draw', room.id, { expectedRevision: 0 });
    expect(result.status).toBe(200);
    expect(result.body.discardPile).toEqual(top);
    const saved = repository.read(room.id)!;
    const cards = [...saved.hand, ...saved.drawPile, ...saved.discardPile];
    expect(cards).toHaveLength(108);
    expect(new Set(cards.map(card => card.id)).size).toBe(108);
    expect(saved.hand).toHaveLength(11);
  });

  it('does not reuse ids when rooms are created in the same millisecond', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123456);
    expect(create().id).not.toEqual(create().id);
  });

  it('returns 404 for missing or malformed ids', () => {
    expect(call(controller, 'info', 'room-missing').status).toBe(404);
    expect(call(controller, 'info', '../../other').status).toBe(404);
  });

  it('keeps a corrupted save intact and returns an explicit unavailable status', () => {
    const state = create();
    const file = join(directory, `${state.id}.json`);
    writeFileSync(file, '{broken');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(call(controller, 'draw', state.id, { expectedRevision: 0 }).status).toBe(503);
    expect(readFileSync(file, 'utf8')).toBe('{broken');
  });

  it('does not acknowledge or persist a failed save', () => {
    const state = create();
    const failing = createGameController({ read: id => repository.read(id), write: () => { throw new Error('disk full'); } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(call(failing, 'draw', state.id, { expectedRevision: 0 }).status).toBe(503);
    expect(call(controller, 'info', state.id).body).toEqual(state);
  });
});
