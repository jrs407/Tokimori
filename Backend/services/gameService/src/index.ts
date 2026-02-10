import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import gameRoutes from './routes/game.routes';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Servir archivos estáticos (imágenes)
app.use('/Miscelanius/gameImage', express.static(path.join(__dirname, '../..', 'Miscelanius/gameImage')));

app.get('/health', (req, res) => {
  res.json({ status: 'Game service is running' });
});

app.use('/games', gameRoutes);

// Error handling para multer
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
  console.log(`Game service running on port ${PORT}`);
});

export default app;
