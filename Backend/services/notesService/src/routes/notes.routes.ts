import { Router } from 'express';
import { createNote } from '../controllers/notes.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const router = Router();

router.post('/create', authMiddleware, createNote);

export default router;
