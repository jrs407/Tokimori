import { Router } from 'express';
import { createGame, gamesList, deleteGame, updateGame, fuseGames, getGameById, getGameListByName } from '../controllers/game.controller';
import { createLibrary, getLibraryListByUserId, getLibraryListHourByUserId, getUsersListByGameId, updateLibrary, searchGamesNotInLibrary, searchGamesInLibrary, getFavoriteGames, getPinnedGames, deleteLibrary } from '../controllers/library.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';
import { uploadGameImage } from '../middlewares/upload.middleware';

const router = Router();

// games routes
router.post('/create', uploadGameImage.single('image'), createGame);
router.get('/gamesList', gamesList);
router.delete('/deleteGame', authMiddleware, adminMiddleware, deleteGame);
router.patch('/updateGame', uploadGameImage.single('image'), authMiddleware, adminMiddleware, updateGame);
router.post('/fuseGames', authMiddleware, adminMiddleware, fuseGames);
router.get('/gameId', getGameById);
router.get('/gameListByName', getGameListByName);

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
router.delete('/deleteLibrary', authMiddleware, deleteLibrary);

export default router;
