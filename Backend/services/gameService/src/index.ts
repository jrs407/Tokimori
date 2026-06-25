import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import itemRoutes from './routes/game.routes';

dotenv.config();

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

app.use('/Miscelanius/gameImage', express.static(path.join(__dirname, '../..', 'Miscelanius/gameImage')));

app.get('/health', (req, res) => {
  res.json({ status: 'Item service is running' });
});

app.use('/items', itemRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof Error) {
    if (err.message === 'Only image files are allowed') {
      return res.status(400).json({ message: 'Only image files are allowed' });
    }
    if (err.message.includes('File too large')) {
      return res.status(400).json({ message: 'File size exceeds 5MB limit' });
    }
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }

  if (err instanceof Error) {
    return res.status(500).json({ message: 'Internal server error' });
  }

  next();
});

const PORT = process.env.PORT || 8001;

app.listen(PORT, () => {
  console.log(`Item service running on port ${PORT}`);
});

export default app;
