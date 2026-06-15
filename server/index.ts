import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseCafeGeoJson } from './parser';

// In-memory cache for on-demand venue enrichment
const enrichmentCache = new Map<string, Record<string, any>>();

if (process.env.NODE_ENV !== 'test' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set in environment variables');
}

const app = express();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL || 'postgres://dummy:dummy@localhost/dummy' });
const prisma = new PrismaClient({ adapter });
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/venues', (req: Request, res: Response) => {
  try {
    const venues = parseCafeGeoJson();
    res.json(venues);
  } catch (error) {
    res.status(500).json({ error: 'Failed to parse venues' });
  }
});

app.get('/venues/enrich', async (req: Request, res: Response) => {
  const { name, lat, lng } = req.query as Record<string, string>;
  if (!name || !lat || !lng) return res.status(400).json({ error: 'name, lat, lng required' });

  const cacheKey = `${name}|${parseFloat(lat).toFixed(4)}|${parseFloat(lng).toFixed(4)}`;
  if (enrichmentCache.has(cacheKey)) return res.json(enrichmentCache.get(cacheKey));

  const FSQ_KEY = process.env.FSQ_API_KEY;
  if (!FSQ_KEY) return res.json({});

  try {
    const searchRes = await axios.get('https://api.foursquare.com/v3/places/search', {
      headers: { Authorization: FSQ_KEY },
      params: { query: name, ll: `${lat},${lng}`, limit: 1, radius: 500 },
    });
    const fsqId = searchRes.data.results?.[0]?.fsq_id;
    if (!fsqId) { enrichmentCache.set(cacheKey, {}); return res.json({}); }

    const detailRes = await axios.get(`https://api.foursquare.com/v3/places/${fsqId}`, {
      headers: { Authorization: FSQ_KEY },
      params: { fields: 'tel,website,hours,location' },
    });
    const d = detailRes.data;
    const result: Record<string, any> = {};
    if (d.tel) result.phone = d.tel;
    if (d.website) result.website = d.website;
    if (d.hours?.display?.length) result.opening_hours = d.hours.display.join('; ');
    if (d.location?.address) result['addr:street'] = d.location.address;

    enrichmentCache.set(cacheKey, result);
    return res.json(result);
  } catch {
    return res.json({});
  }
});

app.get('/auth/register', (req: Request, res: Response) => {
  res.status(405).json({ message: 'Use POST /auth/register to create a new account' });
});

app.post('/auth/register', async (req: Request, res: Response) => {
  const { email: rawEmail, username, password, factionId } = req.body;

  if (!rawEmail || !username || !password || !factionId) {
    return res.status(400).json({ error: 'email, username, password, and factionId are required' });
  }

  const email = rawEmail.toLowerCase().trim();
  const parsedFactionId = typeof factionId === 'number' && factionId > 0 ? factionId : null;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        ...(parsedFactionId ? { factionId: parsedFactionId } : {}),
      },
      include: { faction: { select: { name: true, color: true, icon: true } } },
    });

    return res.status(201).json({
      id: user.id,
      email: user.email,
      username: user.username,
      factionId: user.factionId,
      factionName: user.faction?.name ?? null,
      factionColor: user.faction?.color ?? null,
      factionIcon: user.faction?.icon ?? null,
    });
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
    const user = await prisma.user.findUnique({
      where: { email },
      include: { faction: { select: { name: true, color: true, icon: true } } },
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.status(200).json({
      id: user.id,
      username: user.username,
      factionId: user.factionId,
      factionName: user.faction?.name ?? null,
      factionColor: user.faction?.color ?? null,
      factionIcon: user.faction?.icon ?? null,
    });
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
        reviews: {
          select: {
            rating: true,
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

      for (const review of venue.reviews) {
        const factionId = review.user.factionId;
        if (factionId === null) continue;
        hexScores[venue.h3Index][factionId] = (hexScores[venue.h3Index][factionId] || 0) + review.rating;
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

app.get('/reviews/:venueName', async (req: Request, res: Response) => {
  const { venueName } = req.params;
  try {
    const venue = await prisma.venue.findFirst({
      where: { name: venueName },
      include: {
        reviews: {
          include: {
            user: { select: { username: true, factionId: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    return res.status(200).json(venue.reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

app.post('/reviews', async (req: Request, res: Response) => {
  const { userId, venueName, rating, content } = req.body;

  if (!userId || !venueName || typeof rating !== 'number') {
    return res.status(400).json({ error: 'userId, venueName, and rating are required' });
  }

  try {
    // Bulabildiğimiz ilk venue'yu alalım (ismi eşleşen)
    const venue = await prisma.venue.findFirst({
      where: { name: venueName }
    });

    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    const review = await prisma.review.create({
      data: {
        userId,
        venueId: venue.id,
        rating,
        content
      }
    });

    return res.status(201).json(review);
  } catch (error) {
    console.error('Error creating review:', error);
    return res.status(500).json({ error: 'Failed to create review' });
  }
});

app.get('/factions', async (req: Request, res: Response) => {
  try {
    const factions = await prisma.faction.findMany({
      include: {
        users: { select: { totalPoints: true } },
        creator: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const result = factions.map(f => ({
      id: f.id,
      name: f.name,
      color: f.color,
      icon: f.icon,
      description: f.description,
      memberCount: f.users.length,
      totalPoints: f.users.reduce((sum, u) => sum + u.totalPoints, 0),
      createdAt: f.createdAt,
      creatorName: f.creator?.username ?? null,
    }));
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch factions' });
  }
});

app.post('/factions', async (req: Request, res: Response) => {
  const { name, color, icon, description, createdBy } = req.body;
  if (!name || !color) {
    return res.status(400).json({ error: 'name and color are required' });
  }
  try {
    const faction = await prisma.faction.create({
      data: {
        name: name.trim(),
        color,
        icon: icon || '⚔️',
        description: description?.trim() || null,
        createdBy: createdBy || null,
      },
    });
    if (createdBy) {
      await prisma.user.update({ where: { id: createdBy }, data: { factionId: faction.id } });
    }
    return res.status(201).json(faction);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create faction', details: error instanceof Error ? error.message : undefined });
  }
});

app.post('/factions/:factionId/join', async (req: Request, res: Response) => {
  const factionId = parseInt(req.params.factionId, 10);
  if (isNaN(factionId)) return res.status(400).json({ error: 'Invalid factionId' });

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const faction = await prisma.faction.findUnique({ where: { id: factionId } });
    if (!faction) return res.status(404).json({ error: 'Faction not found' });

    await prisma.user.update({ where: { id: userId }, data: { factionId } });
    return res.json({ success: true, factionId: faction.id, factionName: faction.name, factionColor: faction.color, factionIcon: faction.icon });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to join faction' });
  }
});

app.get('/factions/ranking', async (req: Request, res: Response) => {
  try {
    const factions = await prisma.faction.findMany({
      include: { users: { select: { totalPoints: true } } },
    });
    const ranking = factions
      .map(f => ({
        id: f.id,
        name: f.name,
        color: f.color,
        memberCount: f.users.length,
        totalPoints: f.users.reduce((sum, u) => sum + u.totalPoints, 0),
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);
    return res.json(ranking);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch faction ranking' });
  }
});

app.get('/factions/:factionId/members', async (req: Request, res: Response) => {
  const factionId = parseInt(req.params.factionId, 10);
  if (isNaN(factionId)) return res.status(400).json({ error: 'Invalid factionId' });

  try {
    const members = await prisma.user.findMany({
      where: { factionId },
      select: { id: true, username: true, profilePicture: true, level: true, totalPoints: true },
      orderBy: { totalPoints: 'desc' },
    });
    return res.json(members);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch members' });
  }
});

app.get('/factions/:factionId/messages', async (req: Request, res: Response) => {
  const factionId = parseInt(req.params.factionId, 10);
  if (isNaN(factionId)) return res.status(400).json({ error: 'Invalid factionId' });

  try {
    const messages = await prisma.message.findMany({
      where: { factionId },
      include: { user: { select: { username: true, profilePicture: true } } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    return res.json(messages);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/factions/:factionId/messages', async (req: Request, res: Response) => {
  const factionId = parseInt(req.params.factionId, 10);
  if (isNaN(factionId)) return res.status(400).json({ error: 'Invalid factionId' });

  const { userId, content, type } = req.body;
  if (!userId || !content) return res.status(400).json({ error: 'userId and content are required' });

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.factionId !== factionId) {
      return res.status(403).json({ error: 'User does not belong to this faction' });
    }

    const message = await prisma.message.create({
      data: { userId, factionId, content, type: type || 'text' },
      include: { user: { select: { username: true, profilePicture: true } } },
    });
    return res.status(201).json(message);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

app.get('/users/:userId/profile', async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid userId' });

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        faction: true,
        reviews: {
          include: { venue: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Streak: consecutive days with at least one first-ever venue discovery
    const allReviews = [...user.reviews].reverse(); // oldest first
    const firstDiscoveries = new Map<number, Date>();
    for (const review of allReviews) {
      if (!firstDiscoveries.has(review.venueId)) {
        firstDiscoveries.set(review.venueId, review.createdAt);
      }
    }

    const discoveryDays = new Set<string>();
    for (const date of firstDiscoveries.values()) {
      discoveryDays.add(date.toISOString().split('T')[0]);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    const checkDate = new Date(today);

    if (!discoveryDays.has(checkDate.toISOString().split('T')[0])) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    while (discoveryDays.has(checkDate.toISOString().split('T')[0])) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    const recentReviews = user.reviews.slice(0, 10).map(r => ({
      id: r.id,
      venueName: r.venue.name,
      rating: r.rating,
      content: r.content,
      createdAt: r.createdAt,
    }));

    return res.json({
      id: user.id,
      username: user.username,
      factionId: user.factionId,
      factionName: user.faction?.name ?? null,
      factionColor: user.faction?.color ?? null,
      totalPoints: user.totalPoints,
      level: user.level,
      profilePicture: user.profilePicture,
      streak,
      recentReviews,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/users/:userId/profile-picture', async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid userId' });

  const { profilePicture } = req.body;
  if (!profilePicture || typeof profilePicture !== 'string') {
    return res.status(400).json({ error: 'profilePicture is required' });
  }

  if (!profilePicture.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid image format' });
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { profilePicture },
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error updating profile picture:', error);
    return res.status(500).json({ error: 'Failed to update profile picture' });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

export default app;