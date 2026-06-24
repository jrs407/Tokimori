import { Router } from 'express';
import { createItem, itemsList, deleteItem, updateItem, fuseItems, getItemById, getItemListByName } from '../controllers/game.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';
import { uploadItemImage } from '../middlewares/upload.middleware';

const router = Router();

router.post('/create', uploadItemImage.single('image'), createItem);
router.get('/itemsList', itemsList);
router.delete('/deleteItem', authMiddleware, adminMiddleware, deleteItem);
router.patch('/updateItem', uploadItemImage.single('image'), authMiddleware, adminMiddleware, updateItem);
router.post('/fuseItems', authMiddleware, adminMiddleware, fuseItems);
router.get('/itemId', getItemById);
router.get('/itemListByName', getItemListByName);

export default router;
