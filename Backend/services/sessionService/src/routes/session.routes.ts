import { Router } from 'express';
import { createSession, getSessionCountByUserGame, getSessionCountByUser, getAverageHoursByUserGame, getAverageHoursByUser, getSessionById, getDailyAverageHoursByUserGame, getDailyAverageHoursByUser, getFavoriteDayByUserGame, getFavoriteDayByUser, getLast7DaysByUserGame, getLast7DaysByUser, getMostPlayedGameByUser } from '../controllers/session.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const router = Router();

router.post('/create', authMiddleware, createSession);
router.post('/countByUserGame', authMiddleware, getSessionCountByUserGame);
router.post('/countByUser', authMiddleware, getSessionCountByUser);
router.post('/avgByUserGame', authMiddleware, getAverageHoursByUserGame);
router.post('/avgByUser', authMiddleware, getAverageHoursByUser);
router.post('/getById', authMiddleware, getSessionById);
router.post('/dailyAvgByUserGame', authMiddleware, getDailyAverageHoursByUserGame);
router.post('/dailyAvgByUser', authMiddleware, getDailyAverageHoursByUser);
router.post('/favoriteDayByUserGame', authMiddleware, getFavoriteDayByUserGame);
router.post('/favoriteDayByUser', authMiddleware, getFavoriteDayByUser);
router.post('/last7ByUserGame', authMiddleware, getLast7DaysByUserGame);
router.post('/last7ByUser', authMiddleware, getLast7DaysByUser);
router.post('/mostPlayedGameByUser', authMiddleware, getMostPlayedGameByUser);

export default router;
