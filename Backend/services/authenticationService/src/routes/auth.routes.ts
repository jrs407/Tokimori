import { Router } from 'express';
import { register, login, usersList, getUserById, getUserByEmail} from '../controllers/auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/usersList', usersList);
router.get('/userId', getUserById);
router.get('/userEmail', getUserByEmail);

export default router;
