import request from 'supertest';
import app from './index';

jest.mock('@prisma/client', () => {
  const mockInstance = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    venue: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    review: {
      create: jest.fn(),
    },
    faction: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mockInstance) };
});

jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('./parser', () => ({ parseCafeGeoJson: jest.fn() }));
jest.mock('axios');
jest.mock('h3-js');
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-jwt-token'),
  verify: jest.fn((token: string) => {
    if (token === 'valid-test-token') return { userId: 1, factionId: 1 };
    if (token === 'other-user-token') return { userId: 2, factionId: 2 };
    throw new Error('Invalid token');
  }),
}));
jest.mock('sanitize-html', () => jest.fn((input: string) => input ?? ''));

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as h3 from 'h3-js';

const db = new PrismaClient() as any;
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Extended API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── FR-006: POST /territory/hexgrid ─────────────────────────────────────────

  describe('POST /territory/hexgrid', () => {
    it('returns cells with ownership and boundaries', async () => {
      (h3.polygonToCells as jest.Mock).mockReturnValue(['hex1', 'hex2']);
      (h3.cellToBoundary as jest.Mock).mockReturnValue([[41.0, 29.0], [41.1, 29.1]]);
      db.venue.findMany.mockResolvedValue([
        { h3Index: 'hex1', reviews: [{ rating: 10, user: { factionId: 1 } }] },
      ]);

      const res = await request(app)
        .post('/territory/hexgrid')
        .send({ north: 41.1, south: 40.9, east: 29.1, west: 28.9 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toMatchObject({ h3Index: 'hex1', factionId: 1 });
      expect(res.body[1]).toMatchObject({ h3Index: 'hex2', factionId: null });
      expect(res.body[0].boundary).toHaveLength(2);
      expect(res.body[0].boundary[0]).toMatchObject({ latitude: 41.0, longitude: 29.0 });
    });

    it('returns 400 when bounds missing', async () => {
      const res = await request(app)
        .post('/territory/hexgrid')
        .send({ north: 41.1, south: 40.9 });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'north, south, east, west required' });
    });

    it('returns 400 when viewport too large (>800 cells)', async () => {
      (h3.polygonToCells as jest.Mock).mockReturnValue(new Array(801).fill('h'));
      const res = await request(app)
        .post('/territory/hexgrid')
        .send({ north: 42, south: 40, east: 30, west: 28 });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: 'Viewport too large — zoom in', tooLarge: true });
    });

    it('returns unclaimed hexes gracefully when DB is down', async () => {
      (h3.polygonToCells as jest.Mock).mockReturnValue(['hexA']);
      (h3.cellToBoundary as jest.Mock).mockReturnValue([[41.0, 29.0]]);
      db.venue.findMany.mockRejectedValue(new Error('DB down'));

      const res = await request(app)
        .post('/territory/hexgrid')
        .send({ north: 41.1, south: 40.9, east: 29.1, west: 28.9 });

      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({ h3Index: 'hexA', factionId: null });
    });

    it('hex with null-factionId review is treated as unclaimed', async () => {
      (h3.polygonToCells as jest.Mock).mockReturnValue(['hexNull']);
      (h3.cellToBoundary as jest.Mock).mockReturnValue([[41.0, 29.0]]);
      db.venue.findMany.mockResolvedValue([
        { h3Index: 'hexNull', reviews: [{ rating: 5, user: { factionId: null } }] },
      ]);

      const res = await request(app)
        .post('/territory/hexgrid')
        .send({ north: 41.1, south: 40.9, east: 29.1, west: 28.9 });

      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({ h3Index: 'hexNull', factionId: null });
    });
  });

  // ── FR-007: Reviews ──────────────────────────────────────────────────────────

  describe('GET /reviews/:venueName', () => {
    it('returns review list for existing venue', async () => {
      db.venue.findFirst.mockResolvedValue({
        id: 1,
        name: 'Cafe X',
        reviews: [
          { id: 1, rating: 5, content: 'great', createdAt: new Date(), user: { username: 'u1', factionId: 1 } },
        ],
      });

      const res = await request(app).get('/reviews/Cafe%20X');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].rating).toBe(5);
    });

    it('returns 404 when venue not found', async () => {
      db.venue.findFirst.mockResolvedValue(null);
      const res = await request(app).get('/reviews/NonExistent');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Venue not found' });
    });

    it('returns 500 on DB error', async () => {
      db.venue.findFirst.mockRejectedValue(new Error('DB fail'));
      const res = await request(app).get('/reviews/Cafe');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to fetch reviews' });
    });
  });

  describe('POST /reviews', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).post('/reviews').send({ venueName: 'Cafe Y', rating: 4 });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Authentication required' });
    });

    it('creates a review and returns 201', async () => {
      db.venue.findFirst.mockResolvedValue({ id: 10, name: 'Cafe Y' });
      db.review.create.mockResolvedValue({ id: 5, userId: 1, venueId: 10, rating: 4, content: 'nice' });

      const res = await request(app)
        .post('/reviews')
        .set('Authorization', 'Bearer valid-test-token')
        .send({ venueName: 'Cafe Y', rating: 4, content: 'nice' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 5, rating: 4 });
      expect(db.review.create).toHaveBeenCalledWith({
        data: { userId: 1, venueId: 10, rating: 4, content: 'nice' },
      });
    });

    it('returns 400 when rating is missing', async () => {
      const res = await request(app)
        .post('/reviews')
        .set('Authorization', 'Bearer valid-test-token')
        .send({ venueName: 'Cafe Y' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'venueName and rating are required' });
    });

    it('returns 400 when rating is not a number', async () => {
      const res = await request(app)
        .post('/reviews')
        .set('Authorization', 'Bearer valid-test-token')
        .send({ venueName: 'Cafe Y', rating: 'five' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when venue not found', async () => {
      db.venue.findFirst.mockResolvedValue(null);
      const res = await request(app)
        .post('/reviews')
        .set('Authorization', 'Bearer valid-test-token')
        .send({ venueName: 'Unknown', rating: 3 });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Venue not found' });
    });

    it('returns 500 on DB error', async () => {
      db.venue.findFirst.mockResolvedValue({ id: 10 });
      db.review.create.mockRejectedValue(new Error('insert failed'));
      const res = await request(app)
        .post('/reviews')
        .set('Authorization', 'Bearer valid-test-token')
        .send({ venueName: 'Cafe', rating: 3 });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to create review' });
    });
  });

  // ── FR-008: Factions ─────────────────────────────────────────────────────────

  describe('GET /factions', () => {
    it('returns faction list with member count and total points', async () => {
      db.faction.findMany.mockResolvedValue([
        {
          id: 1, name: 'Red', color: '#f00', icon: '⚔️', description: 'desc',
          createdAt: new Date(),
          users: [{ totalPoints: 100 }, { totalPoints: 50 }],
          creator: { username: 'admin' },
        },
      ]);

      const res = await request(app).get('/factions');
      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({ name: 'Red', memberCount: 2, totalPoints: 150, creatorName: 'admin' });
    });

    it('returns 500 on DB error', async () => {
      db.faction.findMany.mockRejectedValue(new Error('fail'));
      const res = await request(app).get('/factions');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to fetch factions' });
    });
  });

  describe('POST /factions', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).post('/factions').send({ name: 'Blue', color: '#00f' });
      expect(res.status).toBe(401);
    });

    it('creates faction, assigns creator from token, and returns new token', async () => {
      db.faction.create.mockResolvedValue({ id: 3, name: 'Blue', color: '#00f', icon: '🛡️' });
      db.user.update.mockResolvedValue({});

      const res = await request(app)
        .post('/factions')
        .set('Authorization', 'Bearer valid-test-token')
        .send({ name: 'Blue', color: '#00f' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 3, name: 'Blue', token: 'mock-jwt-token' });
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { factionId: 3 },
      });
    });

    it('returns 400 when name missing', async () => {
      const res = await request(app)
        .post('/factions')
        .set('Authorization', 'Bearer valid-test-token')
        .send({ color: '#00f' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'name and color are required' });
    });

    it('returns 400 when color missing', async () => {
      const res = await request(app)
        .post('/factions')
        .set('Authorization', 'Bearer valid-test-token')
        .send({ name: 'Blue' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /factions/:factionId/join', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).post('/factions/2/join').send({});
      expect(res.status).toBe(401);
    });

    it('joins faction successfully and returns new token', async () => {
      db.faction.findUnique.mockResolvedValue({ id: 2, name: 'Green', color: '#0f0', icon: '🌿' });
      db.user.update.mockResolvedValue({});

      const res = await request(app)
        .post('/factions/2/join')
        .set('Authorization', 'Bearer valid-test-token')
        .send({});
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, factionId: 2, factionName: 'Green', token: 'mock-jwt-token' });
    });

    it('returns 404 when faction does not exist', async () => {
      db.faction.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .post('/factions/99/join')
        .set('Authorization', 'Bearer valid-test-token')
        .send({});
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Faction not found' });
    });

    it('returns 400 for non-numeric factionId', async () => {
      const res = await request(app)
        .post('/factions/abc/join')
        .set('Authorization', 'Bearer valid-test-token')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid factionId' });
    });

    it('returns 500 on DB error', async () => {
      db.faction.findUnique.mockResolvedValue({ id: 2 });
      db.user.update.mockRejectedValue(new Error('db fail'));
      const res = await request(app)
        .post('/factions/2/join')
        .set('Authorization', 'Bearer valid-test-token')
        .send({});
      expect(res.status).toBe(500);
    });
  });

  describe('GET /factions/ranking', () => {
    it('returns factions sorted by total points descending', async () => {
      db.faction.findMany.mockResolvedValue([
        { id: 1, name: 'Red', color: '#f00', users: [{ totalPoints: 50 }] },
        { id: 2, name: 'Blue', color: '#00f', users: [{ totalPoints: 200 }] },
      ]);

      const res = await request(app).get('/factions/ranking');
      expect(res.status).toBe(200);
      expect(res.body[0].name).toBe('Blue');
      expect(res.body[0].totalPoints).toBe(200);
      expect(res.body[1].name).toBe('Red');
    });

    it('sums totalPoints across all faction members', async () => {
      db.faction.findMany.mockResolvedValue([
        { id: 1, name: 'X', color: '#000', users: [{ totalPoints: 100 }, { totalPoints: 75 }, { totalPoints: 25 }] },
      ]);

      const res = await request(app).get('/factions/ranking');
      expect(res.status).toBe(200);
      expect(res.body[0].totalPoints).toBe(200);
      expect(res.body[0].memberCount).toBe(3);
    });
  });

  // ── FR-009: Faction messages ─────────────────────────────────────────────────

  describe('GET /factions/:factionId/messages', () => {
    it('returns message list for valid faction', async () => {
      db.message.findMany.mockResolvedValue([
        { id: 1, content: 'hello', factionId: 1, createdAt: new Date(), user: { username: 'u1', profilePicture: null } },
        { id: 2, content: 'world', factionId: 1, createdAt: new Date(), user: { username: 'u2', profilePicture: null } },
      ]);

      const res = await request(app).get('/factions/1/messages');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].content).toBe('hello');
    });

    it('returns 400 for non-numeric factionId', async () => {
      const res = await request(app).get('/factions/abc/messages');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid factionId' });
    });

    it('returns 500 on DB error', async () => {
      db.message.findMany.mockRejectedValue(new Error('DB fail'));
      const res = await request(app).get('/factions/1/messages');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to fetch messages' });
    });
  });

  describe('POST /factions/:factionId/messages', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).post('/factions/1/messages').send({ content: 'hi' });
      expect(res.status).toBe(401);
    });

    it('sends a message when user belongs to faction', async () => {
      db.user.findUnique.mockResolvedValue({ id: 1, factionId: 1 });
      db.message.create.mockResolvedValue({
        id: 5, content: 'hi', factionId: 1, userId: 1, type: 'text',
        createdAt: new Date(),
        user: { username: 'u1', profilePicture: null },
      });

      const res = await request(app)
        .post('/factions/1/messages')
        .set('Authorization', 'Bearer valid-test-token')
        .send({ content: 'hi' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ content: 'hi' });
      expect(db.message.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ factionId: 1, content: 'hi' }) })
      );
    });

    it('returns 403 when user belongs to different faction', async () => {
      db.user.findUnique.mockResolvedValue({ id: 1, factionId: 2 });

      const res = await request(app)
        .post('/factions/1/messages')
        .set('Authorization', 'Bearer valid-test-token')
        .send({ content: 'hi' });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'User does not belong to this faction' });
    });

    it('returns 400 when content missing', async () => {
      const res = await request(app)
        .post('/factions/1/messages')
        .set('Authorization', 'Bearer valid-test-token')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'content is required' });
    });

    it('returns 400 for non-numeric factionId', async () => {
      const res = await request(app)
        .post('/factions/xyz/messages')
        .set('Authorization', 'Bearer valid-test-token')
        .send({ content: 'hi' });
      expect(res.status).toBe(400);
    });
  });

  // ── FR-010: User profile ─────────────────────────────────────────────────────

  describe('GET /users/:userId/profile', () => {
    it('returns profile with streak=1 for a review today', async () => {
      // local midnight → toISOString() UTC date matches algorithm's checkDate regardless of tz offset
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      db.user.findUnique.mockResolvedValue({
        id: 1, username: 'hero', factionId: 1, totalPoints: 500, level: 3,
        profilePicture: null,
        faction: { name: 'Red', color: '#f00' },
        reviews: [
          { id: 1, venueId: 10, rating: 5, content: 'great', createdAt: todayMidnight, venue: { name: 'Cafe X' } },
        ],
      });

      const res = await request(app).get('/users/1/profile');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ username: 'hero', totalPoints: 500, level: 3, streak: 1 });
      expect(res.body.recentReviews).toHaveLength(1);
      expect(res.body.recentReviews[0].venueName).toBe('Cafe X');
    });

    it('returns streak=0 when user has no reviews', async () => {
      db.user.findUnique.mockResolvedValue({
        id: 2, username: 'newbie', factionId: null, totalPoints: 0, level: 1,
        profilePicture: null, faction: null, reviews: [],
      });

      const res = await request(app).get('/users/2/profile');
      expect(res.status).toBe(200);
      expect(res.body.streak).toBe(0);
    });

    it('counts streak across consecutive days (same venue only counted once per day)', async () => {
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const yesterdayMidnight = new Date(todayMidnight);
      yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1);

      db.user.findUnique.mockResolvedValue({
        id: 3, username: 'streak-user', factionId: 1, totalPoints: 300, level: 2,
        profilePicture: null,
        faction: { name: 'Blue', color: '#00f' },
        reviews: [
          { id: 1, venueId: 1, rating: 4, content: '', createdAt: todayMidnight, venue: { name: 'Cafe A' } },
          { id: 2, venueId: 2, rating: 5, content: '', createdAt: yesterdayMidnight, venue: { name: 'Cafe B' } },
        ],
      });

      const res = await request(app).get('/users/3/profile');
      expect(res.status).toBe(200);
      expect(res.body.streak).toBe(2);
    });

    it('returns 404 when user not found', async () => {
      db.user.findUnique.mockResolvedValue(null);
      const res = await request(app).get('/users/999/profile');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'User not found' });
    });

    it('returns 400 for non-numeric userId', async () => {
      const res = await request(app).get('/users/abc/profile');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid userId' });
    });

    it('returns 500 on DB error', async () => {
      db.user.findUnique.mockRejectedValue(new Error('DB fail'));
      const res = await request(app).get('/users/1/profile');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to fetch profile' });
    });
  });

  describe('PUT /users/:userId/profile-picture', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).put('/users/1/profile-picture')
        .send({ profilePicture: 'data:image/png;base64,abc123' });
      expect(res.status).toBe(401);
    });

    it('returns 403 when updating another user\'s picture', async () => {
      const res = await request(app)
        .put('/users/2/profile-picture')
        .set('Authorization', 'Bearer valid-test-token')
        .send({ profilePicture: 'data:image/png;base64,abc123' });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Forbidden' });
    });

    it('updates profile picture successfully', async () => {
      db.user.update.mockResolvedValue({});
      const res = await request(app)
        .put('/users/1/profile-picture')
        .set('Authorization', 'Bearer valid-test-token')
        .send({ profilePicture: 'data:image/png;base64,abc123' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { profilePicture: 'data:image/png;base64,abc123' },
      });
    });

    it('returns 400 when format is not a data URL', async () => {
      const res = await request(app)
        .put('/users/1/profile-picture')
        .set('Authorization', 'Bearer valid-test-token')
        .send({ profilePicture: 'https://example.com/img.png' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid image format' });
    });

    it('returns 400 when profilePicture missing', async () => {
      const res = await request(app)
        .put('/users/1/profile-picture')
        .set('Authorization', 'Bearer valid-test-token')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'profilePicture is required' });
    });

    it('returns 400 for non-numeric userId', async () => {
      const res = await request(app)
        .put('/users/abc/profile-picture')
        .set('Authorization', 'Bearer valid-test-token')
        .send({ profilePicture: 'data:image/png;base64,x' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid userId' });
    });

    it('returns 500 on DB error', async () => {
      db.user.update.mockRejectedValue(new Error('fail'));
      const res = await request(app)
        .put('/users/1/profile-picture')
        .set('Authorization', 'Bearer valid-test-token')
        .send({ profilePicture: 'data:image/jpeg;base64,zzz' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to update profile picture' });
    });
  });

  // ── FR-011: Missions ─────────────────────────────────────────────────────────

  describe('POST /missions/generate', () => {
    it('returns 3 template missions when inference server is unreachable', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Connection refused'));

      const res = await request(app)
        .post('/missions/generate')
        .send({ lang: 'tr' });

      expect(res.status).toBe(200);
      expect(res.body.missions).toHaveLength(3);
      expect(res.body.missions[0]).toMatchObject({
        id: expect.stringMatching(/^mission-/),
        commander: expect.any(String),
        venue: expect.any(String),
        status: expect.any(String),
        points: expect.any(Number),
        rawText: expect.any(String),
        objectives: expect.arrayContaining([
          expect.objectContaining({ text: expect.any(String), done: false }),
        ]),
      });
    });

    it('uses inference data when model returns valid objectives', async () => {
      const fakeMission = {
        commander: 'NEXUS-ALPHA',
        venue: 'Galata Kulesi',
        status: 'Contested',
        objectives: [{ text: 'Neutralize the signal jammer', done: false }],
      };
      mockedAxios.post.mockResolvedValue({ data: fakeMission });

      const res = await request(app)
        .post('/missions/generate')
        .send({ lang: 'en' });

      expect(res.status).toBe(200);
      expect(res.body.missions).toHaveLength(3);
      const usedInference = res.body.missions.some(
        (m: any) => m.objectives[0]?.text === 'Neutralize the signal jammer'
      );
      expect(usedInference).toBe(true);
    });

    it('falls back to template when inference returns empty objectives', async () => {
      mockedAxios.post.mockResolvedValue({ data: { objectives: [] } });

      const res = await request(app)
        .post('/missions/generate')
        .send({ lang: 'tr' });

      expect(res.status).toBe(200);
      res.body.missions.forEach((m: any) => {
        expect(m.objectives.length).toBeGreaterThan(0);
        expect(m.objectives[0].done).toBe(false);
      });
    });
  });

  // ── FR-012: Venue enrichment ─────────────────────────────────────────────────

  describe('GET /venues/enrich', () => {
    const FSQ_KEY_BACKUP = process.env.FSQ_API_KEY;

    beforeEach(() => {
      process.env.FSQ_API_KEY = 'test-fsq-key';
    });

    afterEach(() => {
      process.env.FSQ_API_KEY = FSQ_KEY_BACKUP;
    });

    it('returns enriched venue data from Foursquare', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: { results: [{ fsq_id: 'fsq-001' }] } })
        .mockResolvedValueOnce({
          data: {
            tel: '+90 212 555 0001',
            website: 'https://cafe-r1.com',
            hours: { display: ['Mon-Fri 9-18', 'Sat 10-16'] },
            location: { address: 'Galata Cad. No:1' },
          },
        });

      const res = await request(app)
        .get('/venues/enrich')
        .query({ name: 'Cafe R1', lat: '41.0101', lng: '29.0101' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        phone: '+90 212 555 0001',
        website: 'https://cafe-r1.com',
        opening_hours: 'Mon-Fri 9-18; Sat 10-16',
        'addr:street': 'Galata Cad. No:1',
      });
    });

    it('returns partial data when some Foursquare fields are absent', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: { results: [{ fsq_id: 'fsq-002' }] } })
        .mockResolvedValueOnce({ data: { tel: '+90 212 000 0000' } });

      const res = await request(app)
        .get('/venues/enrich')
        .query({ name: 'Cafe R2', lat: '41.0202', lng: '29.0202' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ phone: '+90 212 000 0000' });
      expect(res.body.website).toBeUndefined();
    });

    it('returns empty object when Foursquare returns no results', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { results: [] } });

      const res = await request(app)
        .get('/venues/enrich')
        .query({ name: 'Cafe R3', lat: '41.0303', lng: '29.0303' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });

    it('returns empty object when FSQ API key is not set', async () => {
      delete process.env.FSQ_API_KEY;

      const res = await request(app)
        .get('/venues/enrich')
        .query({ name: 'Cafe R4', lat: '41.0404', lng: '29.0404' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('returns empty object on Foursquare network error', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const res = await request(app)
        .get('/venues/enrich')
        .query({ name: 'Cafe R5', lat: '41.0505', lng: '29.0505' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });

    it('returns 400 when required params missing', async () => {
      const res = await request(app)
        .get('/venues/enrich')
        .query({ name: 'Cafe Only' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'name, lat, lng required' });
    });
  });
});
