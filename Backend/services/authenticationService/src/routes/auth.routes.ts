import { Router } from 'express';
import { register, login, usersList, getUserById, getUserByEmail, deleteUser, updateUser } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/usersList', usersList);
router.get('/userId', getUserById);
router.get('/userEmail', getUserByEmail);
router.delete('/deleteUser', authMiddleware, deleteUser);
router.put('/updateUser', authMiddleware, updateUser);

export default router;
