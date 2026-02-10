import { Router } from 'express';
import { register, login, usersList, getUserById, getUserByEmail, deleteUser, updateUser, promoteToAdmin, createFirstAdmin } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/createFirstAdmin', createFirstAdmin);

// Protected routes (authentication required)
router.get('/usersList', usersList);
router.get('/userId', getUserById);
router.get('/userEmail', getUserByEmail);
router.delete('/deleteUser', authMiddleware, deleteUser);
router.put('/updateUser', authMiddleware, updateUser);

// Admin-only routes
router.post('/promoteToAdmin', authMiddleware, adminMiddleware, promoteToAdmin);

export default router;
