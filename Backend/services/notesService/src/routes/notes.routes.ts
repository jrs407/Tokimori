import { Router } from 'express';
import {  } from '../controllers/notes.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const router = Router();



export default router;
