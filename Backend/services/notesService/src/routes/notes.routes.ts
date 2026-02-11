import { Router } from 'express';
import { createNote, updateNote, getNotesByLibrary } from '../controllers/notes.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const router = Router();

router.post('/create', authMiddleware, createNote);
router.patch('/update', authMiddleware, updateNote);
router.post('/listByLibrary', authMiddleware, getNotesByLibrary);

export default router;
