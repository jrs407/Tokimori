import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import objectivesRoutes from './routes/objectives.routes';
import canvasRoutes from './routes/canvas.routes';

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
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'Objectives service is running' });
});

app.use('/objectives', objectivesRoutes);
app.use('/canvas', canvasRoutes);

const PORT = process.env.PORT || 8004;

app.listen(PORT, () => {
  console.log(`Objectives service running on port ${PORT}`);
});

export default app;
