import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv'
import notesRoutes from './routes/notes.routes';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'Notes service is running' });
});

app.use('/notes', notesRoutes);

const PORT = process.env.PORT || 8003;

app.listen(PORT, () => {
  console.log(`Notes service running on port ${PORT}`);
});

export default app;
