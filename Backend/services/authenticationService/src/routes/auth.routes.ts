import { Router } from 'express';
import { register, login, usersList } from '../controllers/auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/users', usersList);

export default router;
