import { Router } from "express"
import * as gameController from '../controllers/game'

const router = Router();

router.post('', gameController.create);

router.get('/:id', gameController.info);
router.post('/:id/draw', gameController.draw);
router.post('/:id/discard', gameController.discard);

export default router;
