import { Router } from 'express';
import { createBandHandler, listBandsHandler, addMemberHandler, setActiveBandHandler } from '../controllers/bandas.controller';

const router = Router();

router.post('/', createBandHandler);
router.get('/', listBandsHandler);
router.post('/:id/membros', addMemberHandler);

export const contextoRouter = Router();
contextoRouter.patch('/ativa', setActiveBandHandler);

export default router;
