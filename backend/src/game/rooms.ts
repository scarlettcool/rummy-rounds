import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { dealHands, generateDeck, shuffle } from './engine/deck';
import { Card } from './engine/types/card.types';
import { ChallengeState, isChallengeState } from './rules/challenge';

export interface RoomState {
  id: string;
  created: number;
  revision: number;
  turn: number;
  drawPile: Card[];
  hand: Card[];
  discardPile: Card[];
  hasDrawn: boolean;
  challenge?: ChallengeState;
}

export function newRoom(mode: 'practice' | 'challenge' = 'practice'): RoomState {
  const { hands, remainingDeck } = dealHands(shuffle(generateDeck()), 1);
  return {
    id: `room-${randomUUID()}`,
    created: Date.now(),
    revision: 0,
    turn: 1,
    hand: hands[0],
    discardPile: [remainingDeck.shift()!],
    drawPile: remainingDeck,
    hasDrawn: false,
    ...(mode === 'challenge' ? { challenge: { goal: 'two-sets' as const, status: 'active' as const } } : {}),
  };
}

export function roomView(room: RoomState) {
  return {
    id: room.id,
    created: room.created,
    revision: room.revision,
    turn: room.turn,
    drawPileCount: room.drawPile.length,
    discardPile: room.discardPile.at(-1) ?? null,
    player: { id: 'local-player', name: '你', hand: room.hand, hasDrawn: room.hasDrawn },
    ...(room.challenge ? { challenge: room.challenge } : {}),
  };
}

export interface RoomRepository {
  read(id: string): RoomState | undefined;
  write(room: RoomState): void;
}

// One server process owns this directory. Read a fresh snapshot for each action;
// publish it only after the complete replacement file has reached disk.
export class FileRoomRepository implements RoomRepository {
  constructor(private readonly directory: string) {}

  read(id: string): RoomState | undefined {
    if (!/^room-[a-zA-Z0-9-]{1,80}$/.test(id)) return undefined;
    let raw: string;
    try {
      raw = readFileSync(join(this.directory, `${id}.json`), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
    const room: RoomState = JSON.parse(raw);
    // Fail closed on an invalid snapshot. Never overwrite a broken save with
    // a fresh game or silently switch a connected player to a local hand.
    const cards = [...room.hand, ...room.drawPile, ...room.discardPile];
    const deckIds = new Set(generateDeck().map(card => card.id));
    if (room.id !== id || !Number.isSafeInteger(room.revision) || room.revision < 0 ||
        !Number.isSafeInteger(room.turn) || room.turn < 1 || !Number.isFinite(room.created) ||
        typeof room.hasDrawn !== 'boolean' || room.hand.length !== (room.hasDrawn ? 11 : 10) ||
        room.discardPile.length < 1 || cards.length !== 108 ||
        new Set(cards.map(card => card.id)).size !== 108 ||
        cards.some(card => !deckIds.has(card.id) || !card.id.startsWith(`${card.color}-${card.value}-`)) ||
        (room.challenge !== undefined && (!isChallengeState(room.challenge, room.hand, room.hasDrawn, room.turn) ||
          (room.challenge.status === 'completed' && room.revision === 0)))) {
      throw new Error('Invalid room snapshot');
    }
    return room;
  }

  write(room: RoomState): void {
    mkdirSync(this.directory, { recursive: true });
    const temporary = join(this.directory, `${room.id}.pending`);
    const fd = openSync(temporary, 'w');
    try {
      writeFileSync(fd, JSON.stringify(room), 'utf8');
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, join(this.directory, `${room.id}.json`));
    const directoryFd = openSync(this.directory, 'r');
    try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
  }
}
