import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv'
import sessionRoutes from './routes/session.routes';

dotenv.config();

const app = express();

app.use(cors());
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
