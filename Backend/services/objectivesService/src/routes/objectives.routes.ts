import { Router } from 'express';
import { createObjective, updateObjective, getObjectivesByLibrary, deleteObjective, getFavoriteObjectives, getPinnedObjectives, getObjectivesByUser, getObjective, searchObjectivesByTitle } from '../controllers/objectives.controller';
import { createTask, deleteTask, getTasksByObjective, getIncompleteTasksByObjective, getCompletedTasksByObjective, getTaskById, deleteCompletedTasksByObjective } from '../controllers/tasks.controller';
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
router.delete('/deleteTask', authMiddleware, deleteTask);
router.post('/tasksByObjective', authMiddleware, getTasksByObjective);
router.post('/tasksByObjective/incomplete', authMiddleware, getIncompleteTasksByObjective);
router.post('/tasksByObjective/completed', authMiddleware, getCompletedTasksByObjective);
router.post('/task', authMiddleware, getTaskById);
router.delete('/tasksByObjective/completed', authMiddleware, deleteCompletedTasksByObjective);


export default router;
