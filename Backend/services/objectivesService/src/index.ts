import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv'
import objectivesRoutes from './routes/objectives.routes';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'Objectives service is running' });
});

app.use('/objectives', objectivesRoutes);

const PORT = process.env.PORT || 8004;

app.listen(PORT, () => {
  console.log(`Objectives service running on port ${PORT}`);
});

export default app;
