import { Router } from 'express';
import { createObjective, updateObjective, getObjectivesByLibrary, deleteObjective, getFavoriteObjectives, getPinnedObjectives, getObjectivesByUser, getObjective, searchObjectivesByTitle } from '../controllers/objectives.controller';
import { createTask } from '../controllers/tasks.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const router = Router();

// objectives routes
router.post('/create', authMiddleware, createObjective);
router.patch('/update', authMiddleware, updateObjective);
router.post('/listByLibrary', authMiddleware, getObjectivesByLibrary);
router.delete('/delete', authMiddleware, deleteObjective);
router.post('/favoriteObjectives', authMiddleware, getFavoriteObjectives);
router.post('/pinnedObjectives', authMiddleware, getPinnedObjectives);
router.post('/listByUser', authMiddleware, getObjectivesByUser);
router.post('/getObjective', authMiddleware, getObjective);
router.post('/search', authMiddleware, searchObjectivesByTitle);

// tasks routes
router.post('/createTask', authMiddleware, createTask);

export default router;
