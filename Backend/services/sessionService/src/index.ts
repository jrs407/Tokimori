import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import sessionRoutes from './routes/session.routes';

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

app.get('/health', (req, res) => {
  res.json({ status: 'Session service is running' });
});

app.use('/sessions', sessionRoutes);

const PORT = process.env.PORT || 8004;

app.listen(PORT, () => {
  console.log(`Objectives service running on port ${PORT}`);
});

export default app;
