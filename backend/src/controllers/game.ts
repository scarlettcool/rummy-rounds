import { Request, Response } from 'express';
import { resolve } from 'node:path';
import { shuffle } from '../game/engine/deck';
import { FileRoomRepository, newRoom, roomView, RoomRepository, RoomState } from '../game/rooms';

export function createGameController(repository: RoomRepository) {
  function withRoom(req: Request, res: Response, action: (room: RoomState) => void) {
    try {
      const room = repository.read(req.params.id);
      if (!room) { res.status(404).send({ message: '房间不存在，请返回大厅重新开始。' }); return; }
      action(room);
    } catch (error) {
      console.error('Room storage failed:', error);
      res.status(503).send({ message: '牌局暂时无法保存，请稍后重新同步。' });
    }
  }

  function canAct(req: Request, res: Response, room: RoomState): boolean {
    if (!Number.isSafeInteger(req.body?.expectedRevision) || req.body.expectedRevision < 0) {
      res.status(400).send({ message: '请先同步牌局再操作。' });
      return false;
    }
    if (req.body.expectedRevision !== room.revision) {
      res.status(409).send({ message: '牌局已在其他页面更新，请重新同步。', state: roomView(room) });
      return false;
    }
    return true;
  }

  function save(res: Response, room: RoomState) {
    room.revision += 1;
    repository.write(room);
    res.send(roomView(room));
  }

  return {
    create(_req: Request, res: Response): void {
      try {
        const room = newRoom();
        repository.write(room);
        res.status(201).send({ id: room.id, state: roomView(room) });
      } catch (error) {
        console.error('Room creation failed:', error);
        res.status(503).send({ message: '暂时无法创建牌局，请稍后重试或选择离线练习。' });
      }
    },
    info(req: Request, res: Response): void {
      withRoom(req, res, room => res.send(roomView(room)));
    },
    draw(req: Request, res: Response): void {
      withRoom(req, res, room => {
        if (!canAct(req, res, room)) return;
        if (room.hasDrawn) {
          res.status(409).send({ message: '本回合已摸牌，请先弃牌。', state: roomView(room) });
          return;
        }
        if (!room.drawPile.length && room.discardPile.length > 1) {
          const top = room.discardPile.pop()!;
          room.drawPile = shuffle(room.discardPile);
          room.discardPile = [top];
        }
        const card = room.drawPile.shift();
        if (!card) { res.status(409).send({ message: '没有可摸的牌。', state: roomView(room) }); return; }
        room.hand.push(card);
        room.hasDrawn = true;
        save(res, room);
      });
    },
    discard(req: Request, res: Response): void {
      withRoom(req, res, room => {
        if (!canAct(req, res, room)) return;
        if (!room.hasDrawn) {
          res.status(409).send({ message: '请先摸牌。', state: roomView(room) });
          return;
        }
        const cardId = req.body?.cardId;
        if (typeof cardId !== 'string' || !cardId) {
          res.status(400).send({ message: '请选择要弃掉的牌。' });
          return;
        }
        const index = room.hand.findIndex(card => card.id === cardId);
        if (index === -1) { res.status(400).send({ message: '这张牌不在你的手牌中。' }); return; }
        room.discardPile.push(room.hand.splice(index, 1)[0]);
        room.hasDrawn = false;
        room.turn += 1;
        save(res, room);
      });
    },
  };
}

// Resolve after dotenv.config() in app.ts, not during static module imports.
let controller: ReturnType<typeof createGameController> | undefined;
function handlers() {
  return controller ??= createGameController(new FileRoomRepository(
    resolve(process.env.ROOM_DATA_DIR || '.data/rooms'),
  ));
}
export const create = (req: Request, res: Response): void => handlers().create(req, res);
export const info = (req: Request, res: Response): void => handlers().info(req, res);
export const draw = (req: Request, res: Response): void => handlers().draw(req, res);
export const discard = (req: Request, res: Response): void => handlers().discard(req, res);
