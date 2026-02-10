import { Router } from 'express';
import { createGame } from '../controllers/game.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';
import { uploadGameImage } from '../middlewares/upload.middleware';

const router = Router();


router.post('/create', uploadGameImage.single('image'), createGame);

export default router;
