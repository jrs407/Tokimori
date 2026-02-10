import { Router } from 'express';
import { register, login, usersList, getUserById} from '../controllers/auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/usersList', usersList);
router.get('/userId', getUserById);

export default router;
