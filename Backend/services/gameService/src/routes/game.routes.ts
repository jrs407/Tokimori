import { Router } from 'express';
import { createGame, gamesList, deleteGame, getGameById, getGameListByName } from '../controllers/game.controller';
import { createLibrary } from '../controllers/library.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';
import { uploadGameImage } from '../middlewares/upload.middleware';

const router = Router();

// games routes
router.post('/create', uploadGameImage.single('image'), createGame);
router.get('/gamesList', gamesList);
router.delete('/deleteGame', authMiddleware, adminMiddleware, deleteGame);
router.get('/gameId', getGameById);
router.get('/gameListByName', getGameListByName);

// library routes
router.post('/createLibrary', authMiddleware, createLibrary);

export default router;
