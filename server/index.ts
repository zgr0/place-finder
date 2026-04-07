import express, { Request, Response } from 'express';
import { getCafes } from './parser';

const app = express();
const port = process.env.PORT || 3000;

app.get('/cafes', (req: Request, res: Response) => {
  try {
    const cafes = getCafes();
    res.json({ cafes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to parse cafes' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});