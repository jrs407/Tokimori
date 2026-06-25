import { Router } from 'express';
import { getCanvasByLibrary, createCanvas, updateCanvas, deleteCanvas } from '../controllers/canvas.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.post('/listByLibrary', authMiddleware, getCanvasByLibrary);
router.post('/create', authMiddleware, createCanvas);
router.patch('/update', authMiddleware, updateCanvas);
router.delete('/delete', authMiddleware, deleteCanvas);

export default router;
