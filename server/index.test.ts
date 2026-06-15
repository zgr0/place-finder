import request from 'supertest';
import app from './index';
import bcrypt from 'bcrypt';
import { parseCafeGeoJson } from './parser';

jest.mock('@prisma/client', () => {
  const mockPrismaClientInstance = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    venue: {
      findMany: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrismaClientInstance),
  };
});

import { PrismaClient } from '@prisma/client';
const prismaMock = new PrismaClient() as any;
const mockPrismaUser = prismaMock.user;
const mockPrismaVenue = prismaMock.venue;

jest.mock('@prisma/adapter-pg', () => {
  return { PrismaPg: jest.fn() };
});

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('./parser', () => ({
  parseCafeGeoJson: jest.fn(),
}));

describe('Backend API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /venues', () => {
    it('should return 200 and mocked venues upon success', async () => {
      const mockVenues = { type: 'FeatureCollection', features: [] };
      (parseCafeGeoJson as jest.Mock).mockReturnValue(mockVenues);

      const res = await request(app).get('/venues');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockVenues);
      expect(parseCafeGeoJson).toHaveBeenCalledTimes(1);
    });

    it('should return 500 when parser fails', async () => {
      (parseCafeGeoJson as jest.Mock).mockImplementation(() => {
        throw new Error('Parse error');
      });

      const res = await request(app).get('/venues');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to parse venues' });
    });
  });

  describe('GET /auth/register', () => {
    it('should return 405 Method Not Allowed', async () => {
      const res = await request(app).get('/auth/register');
      expect(res.status).toBe(405);
      expect(res.body).toEqual({ message: 'Use POST /auth/register to create a new account' });
    });
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully, normalizing the email', async () => {
      mockPrismaUser.create.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        username: 'TestUser',
        factionId: 1,
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword123');

      const payload = {
        email: '  TeSt@eXaMpLe.com  ',
        username: 'TestUser',
        password: 'password_123',
        factionId: 1,
      };

      const res = await request(app)
        .post('/auth/register')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: 1,
        email: 'test@example.com',
        username: 'TestUser',
        factionId: 1,
        factionName: null,
        factionColor: null,
        factionIcon: null,
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('password_123', 10);
      expect(mockPrismaUser.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          username: 'TestUser',
          password: 'hashedPassword123',
          factionId: 1,
        },
        include: { faction: { select: { name: true, color: true, icon: true } } },
      });
    });

    it('should return 400 if required fields are missing', async () => {
      const res = await request(app).post('/auth/register').send({
        email: 'missing_others@test.com'
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'email, username, password, and factionId are required' });
    });

    it('should return 500 on database failure', async () => {
      mockPrismaUser.create.mockRejectedValue(new Error('DB Error'));
      (bcrypt.hash as jest.Mock).mockResolvedValue('mockHash');

      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'x@x.com', username: 'x', password: 'y', factionId: 1 });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Registration failed', details: 'DB Error' });
    });
  });

  describe('POST /auth/login', () => {
    it('should log in successfully when credentials match', async () => {
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        username: 'TestUser',
        password: 'hashedPassword123',
        factionId: 2,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await request(app)
        .post('/auth/login')
        .send({ email: '   test@example.com', password: 'password_123' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 1, username: 'TestUser', factionId: 2, factionName: null, factionColor: null, factionIcon: null });

      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' }, include: { faction: { select: { name: true, color: true, icon: true } } } });
      expect(bcrypt.compare).toHaveBeenCalledWith('password_123', 'hashedPassword123');
    });

    it('should return 401 on non-existent user email', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/auth/login').send({ email: 'no_exist@x.com', password: 'y' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid credentials' });
    });

    it('should return 401 on incorrect password comparison', async () => {
      mockPrismaUser.findUnique.mockResolvedValue({ password: 'hash' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const res = await request(app).post('/auth/login').send({ email: 'x@x.com', password: 'wrong' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid credentials' });
    });

    it('should return 400 if fields are missing', async () => {
      const res = await request(app).post('/auth/login').send({ email: 'x@x.com' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'email and password are required' });
    });
  });

  describe('POST /territory/ownership', () => {
    it('should properly calculate dominant faction for requested hexes via database reviews aggregation', async () => {
      // Hex "hex1" has reviews from faction 1 (10 pts) and faction 2 (20 pts) -> Faction 2 should win
      // Hex "hex2" has reviews from faction 1 (15 pts) and faction 3 (5 pts) -> Faction 1 should win
      const mockVenues = [
        {
          h3Index: 'hex1',
          reviews: [
            { rating: 10, user: { factionId: 1 } },
            { rating: 20, user: { factionId: 2 } },
          ],
        },
        {
          h3Index: 'hex2',
          reviews: [
            { rating: 15, user: { factionId: 1 } },
            { rating: 5, user: { factionId: 3 } },
          ],
        },
      ];

      mockPrismaVenue.findMany.mockResolvedValue(mockVenues);

      const res = await request(app)
        .post('/territory/ownership')
        .send({ hexIds: ['hex1', 'hex2'] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { h3Index: 'hex1', factionId: 2 },
        { h3Index: 'hex2', factionId: 1 },
      ]);

      expect(mockPrismaVenue.findMany).toHaveBeenCalledWith({
        where: { h3Index: { in: ['hex1', 'hex2'] } },
        select: expect.any(Object),
      });
    });

    it('should handle tiebreak implicitly by later enum in object iteration, or standard max finding logic', async () => {
      const mockVenues = [
        {
          h3Index: 'hexTie',
          reviews: [
            { rating: 15, user: { factionId: 1 } },
            { rating: 15, user: { factionId: 2 } },
          ]
        }
      ];
      mockPrismaVenue.findMany.mockResolvedValue(mockVenues);

      const res = await request(app).post('/territory/ownership').send({ hexIds: ['hexTie'] });
      
      expect(res.status).toBe(200);
      // Depending on iteration order it could be 1 or 2, checking for one of them confirms non-crashing logic
      expect([1, 2]).toContain(res.body[0].factionId);
      expect(res.body[0].h3Index).toBe('hexTie');
    });

    it('should return 400 if hexIds array is missing', async () => {
      const res = await request(app).post('/territory/ownership').send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'hexIds array is required' });
    });

    it('should return 500 on database error during calculation', async () => {
      mockPrismaVenue.findMany.mockRejectedValue(new Error('DB Query Failed'));

      const res = await request(app).post('/territory/ownership').send({ hexIds: ['hex1'] });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to calculate territory ownership' });
    });
  });
});
