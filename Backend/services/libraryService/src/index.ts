import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import libraryRoutes from './routes/library.routes';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());


app.get('/health', (req, res) => {
  res.json({ status: 'Library service is running' });
});

app.use('/library', libraryRoutes);

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

const PORT = process.env.PORT || 8002;

app.listen(PORT, () => {
  console.log(`Library service running on port ${PORT}`);
});

export default app;
