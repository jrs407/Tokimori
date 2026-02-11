import { Router } from 'express';
import { createLibrary, getLibraryListByUserId, getLibraryListHourByUserId, getUsersListByGameId, updateLibrary, searchGamesNotInLibrary, searchGamesInLibrary, getFavoriteGames, getPinnedGames, deleteLibrary, getLibrary } from '../controllers/library.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const router = Router();

// library routes
router.post('/createLibrary', authMiddleware, createLibrary);
router.get('/libraryListByUserId', authMiddleware, getLibraryListByUserId);
router.get('/libraryListHourByUserId', authMiddleware, getLibraryListHourByUserId);
router.get('/usersListByGameId', getUsersListByGameId);
router.patch('/updateLibrary', authMiddleware, updateLibrary);
router.post('/searchGamesNotInLibrary', authMiddleware, searchGamesNotInLibrary);
router.post('/searchGamesInLibrary', authMiddleware, searchGamesInLibrary);
router.post('/favoriteGames', authMiddleware, getFavoriteGames);
router.post('/pinnedGames', authMiddleware, getPinnedGames);
router.post('/getLibrary', authMiddleware, getLibrary);
router.delete('/deleteLibrary', authMiddleware, deleteLibrary);

export default router;
