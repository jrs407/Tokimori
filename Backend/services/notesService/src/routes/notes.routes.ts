import { Router } from 'express';
import { createNote, updateNote, getNotesByLibrary, getPinnedNotes, getFavoriteNotes, deleteNote, getNote, getNotesByUser, searchNotesByTitle } from '../controllers/notes.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const router = Router();

router.post('/create', authMiddleware, createNote);
router.patch('/update', authMiddleware, updateNote);
router.post('/listByLibrary', authMiddleware, getNotesByLibrary);
router.post('/pinnedNotes', authMiddleware, getPinnedNotes);
router.post('/favoriteNotes', authMiddleware, getFavoriteNotes);
router.delete('/delete', authMiddleware, deleteNote);
router.post('/getNote', authMiddleware, getNote);
router.post('/listByUser', authMiddleware, getNotesByUser);
router.post('/search', authMiddleware, searchNotesByTitle);

export default router;
