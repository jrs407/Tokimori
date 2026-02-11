import { Router } from 'express';
import { createObjective } from '../controllers/objectives.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const router = Router();

router.post('/create', authMiddleware, createObjective);

export default router;
