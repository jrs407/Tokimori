import { Router } from 'express';
import { createGame, gamesList, deleteGame, updateGame, fuseGames, getGameById, getGameListByName } from '../controllers/game.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';
import { uploadGameImage } from '../middlewares/upload.middleware';

const router = Router();

// games routes
router.post('/create', uploadGameImage.single('image'), createGame);
router.get('/gamesList', gamesList);
router.delete('/deleteGame', authMiddleware, adminMiddleware, deleteGame);
router.patch('/updateGame', uploadGameImage.single('image'), authMiddleware, adminMiddleware, updateGame);
router.post('/fuseGames', authMiddleware, adminMiddleware, fuseGames);
router.get('/gameId', getGameById);
router.get('/gameListByName', getGameListByName);

export default router;
