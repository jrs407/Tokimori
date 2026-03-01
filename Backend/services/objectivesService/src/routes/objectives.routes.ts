import { Router } from 'express';
import { createObjective, updateObjective, getObjectivesByLibrary, deleteObjective, getFavoriteObjectives, getPinnedObjectives, getObjectivesByUser, getObjective, searchObjectivesByTitle } from '../controllers/objectives.controller';
import { createTask, deleteTask, updateTask, getTasksByObjective, getIncompleteTasksByObjective, getCompletedTasksByObjective, getFavoriteCompletedTasksByObjective, getFavoriteIncompleteTasksByObjective, getPinnedCompletedTasksByObjective, getPinnedIncompleteTasksByObjective, getAllFavoriteTasksByObjective, getAllPinnedTasksByObjective, searchTasksByTitle, getTaskById, deleteCompletedTasksByObjective, markAllTasksCompletedByObjective, markAllTasksIncompleteByObjective } from '../controllers/tasks.controller';
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
router.patch('/updateTask', authMiddleware, updateTask);
router.delete('/deleteTask', authMiddleware, deleteTask);
router.post('/tasksByObjective', authMiddleware, getTasksByObjective);
router.post('/tasksByObjective/incomplete', authMiddleware, getIncompleteTasksByObjective);
router.post('/tasksByObjective/completed', authMiddleware, getCompletedTasksByObjective);
router.post('/task', authMiddleware, getTaskById);
router.delete('/tasksByObjective/completed', authMiddleware, deleteCompletedTasksByObjective);
router.patch('/tasksByObjective/markCompleted', authMiddleware, markAllTasksCompletedByObjective);
router.patch('/tasksByObjective/markIncomplete', authMiddleware, markAllTasksIncompleteByObjective);
router.post('/tasksByObjective/favorite/completed', authMiddleware, getFavoriteCompletedTasksByObjective);
router.post('/tasksByObjective/favorite/incomplete', authMiddleware, getFavoriteIncompleteTasksByObjective);
router.post('/tasksByObjective/pinned/completed', authMiddleware, getPinnedCompletedTasksByObjective);
router.post('/tasksByObjective/pinned/incomplete', authMiddleware, getPinnedIncompleteTasksByObjective);
router.post('/tasksByObjective/all/favorite', authMiddleware, getAllFavoriteTasksByObjective);
router.post('/tasksByObjective/all/pinned', authMiddleware, getAllPinnedTasksByObjective);
router.post('/tasksByObjective/search', authMiddleware, searchTasksByTitle);


export default router;
