import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseCafeGeoJson } from './parser';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set in environment variables');
}

const app = express();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/venues', (req: Request, res: Response) => {
  try {
    const venues = parseCafeGeoJson();
    res.json(venues);
  } catch (error) {
    res.status(500).json({ error: 'Failed to parse venues' });
  }
});

app.get('/auth/register', (req: Request, res: Response) => {
  res.status(405).json({ message: 'Use POST /auth/register to create a new account' });
});

app.post('/auth/register', async (req: Request, res: Response) => {
  const { email: rawEmail, username, password, factionId } = req.body;

  if (!rawEmail || !username || !password || typeof factionId !== 'number') {
    return res.status(400).json({ error: 'email, username, password, and factionId are required' });
  }

  const email = rawEmail.toLowerCase().trim();

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        factionId,
      },
    });

    return res.status(201).json({ id: user.id, email: user.email, username: user.username, factionId: user.factionId });
  } catch (error) {
    return res.status(500).json({ error: 'Registration failed', details: error instanceof Error ? error.message : undefined });
  }
});

app.post('/auth/login', async (req: Request, res: Response) => {
  const { email: rawEmail, password } = req.body;

  if (!rawEmail || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const email = rawEmail.toLowerCase().trim();

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.status(200).json({ id: user.id, username: user.username, factionId: user.factionId });
  } catch (error) {
    return res.status(500).json({ error: 'Login failed', details: error instanceof Error ? error.message : undefined });
  }
});

app.post('/territory/ownership', async (req: Request, res: Response) => {
  const { hexIds } = req.body;
  if (!hexIds || !Array.isArray(hexIds)) {
    return res.status(400).json({ error: 'hexIds array is required' });
  }

  try {
    const venues = await prisma.venue.findMany({
      where: { h3Index: { in: hexIds } },
      select: {
        h3Index: true,
        visits: {
          select: {
            points: true,
            user: { select: { factionId: true } }
          }
        }
      }
    });

    const hexScores: Record<string, Record<number, number>> = {};

    for (const venue of venues) {
      if (!hexScores[venue.h3Index]) {
        hexScores[venue.h3Index] = {};
      }

      for (const visit of venue.visits) {
        const factionId = visit.user.factionId;
        hexScores[venue.h3Index][factionId] = (hexScores[venue.h3Index][factionId] || 0) + visit.points;
      }
    }

    const ownershipData = [];
    for (const [h3Index, factionScores] of Object.entries(hexScores)) {
      let winningFactionId = null;
      let maxScore = -1;

      for (const [factionIdStr, score] of Object.entries(factionScores)) {
        if (score > maxScore) {
          maxScore = score;
          winningFactionId = parseInt(factionIdStr, 10);
        }
      }

      if (winningFactionId !== null) {
        ownershipData.push({
          h3Index,
          factionId: winningFactionId
        });
      }
    }

    res.json(ownershipData);
  } catch (error) {
    console.error('Error calculating territory ownership:', error);
    res.status(500).json({ error: 'Failed to calculate territory ownership' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});