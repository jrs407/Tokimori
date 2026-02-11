import { Router } from 'express';
import { createObjective } from '../controllers/objectives.controller';
import { createTask } from '../controllers/tasks.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const router = Router();

// objectives routes
router.post('/create', authMiddleware, createObjective);

// tasks routes
router.post('/createTask', authMiddleware, createTask);

export default router;
