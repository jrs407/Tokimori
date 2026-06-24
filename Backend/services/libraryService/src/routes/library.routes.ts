import { Router } from 'express';
import {
  createCollection,
  getCollectionListByUserId,
  getCollectionListHourByUserId,
  getUsersListByItemId,
  updateCollection,
  searchItemsNotInCollection,
  searchItemsInCollection,
  getFavoriteItems,
  getPinnedItems,
  getCollection,
  deleteCollection,
} from '../controllers/library.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.post('/createCollection', authMiddleware, createCollection);
router.post('/collectionListByUserId', authMiddleware, getCollectionListByUserId);
router.post('/collectionListHourByUserId', authMiddleware, getCollectionListHourByUserId);
router.get('/usersListByItemId', getUsersListByItemId);
router.patch('/updateCollection', authMiddleware, updateCollection);
router.post('/searchItemsNotInCollection', authMiddleware, searchItemsNotInCollection);
router.post('/searchItemsInCollection', authMiddleware, searchItemsInCollection);
router.post('/favoriteItems', authMiddleware, getFavoriteItems);
router.post('/pinnedItems', authMiddleware, getPinnedItems);
router.post('/getCollection', authMiddleware, getCollection);
router.delete('/deleteCollection', authMiddleware, deleteCollection);

export default router;
