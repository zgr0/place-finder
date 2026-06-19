"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const axios_1 = __importDefault(require("axios"));
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const parser_1 = require("./parser");
const h3 = __importStar(require("h3-js"));
// In-memory cache for on-demand venue enrichment
const enrichmentCache = new Map();
if (process.env.NODE_ENV !== 'test' && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set in environment variables');
}
const app = (0, express_1.default)();
const adapter = new adapter_pg_1.PrismaPg({ connectionString: process.env.DATABASE_URL || 'postgres://dummy:dummy@localhost/dummy' });
const prisma = new client_1.PrismaClient({ adapter });
const port = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '5mb' }));
app.get('/venues', (req, res) => {
    try {
        const venues = (0, parser_1.parseCafeGeoJson)();
        res.json(venues);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to parse venues' });
    }
});
app.get('/venues/enrich', async (req, res) => {
    const { name, lat, lng } = req.query;
    if (!name || !lat || !lng)
        return res.status(400).json({ error: 'name, lat, lng required' });
    const cacheKey = `${name}|${parseFloat(lat).toFixed(4)}|${parseFloat(lng).toFixed(4)}`;
    if (enrichmentCache.has(cacheKey))
        return res.json(enrichmentCache.get(cacheKey));
    const FSQ_KEY = process.env.FSQ_API_KEY;
    if (!FSQ_KEY)
        return res.json({});
    try {
        const searchRes = await axios_1.default.get('https://api.foursquare.com/v3/places/search', {
            headers: { Authorization: FSQ_KEY },
            params: { query: name, ll: `${lat},${lng}`, limit: 1, radius: 500 },
        });
        const fsqId = searchRes.data.results?.[0]?.fsq_id;
        if (!fsqId) {
            enrichmentCache.set(cacheKey, {});
            return res.json({});
        }
        const detailRes = await axios_1.default.get(`https://api.foursquare.com/v3/places/${fsqId}`, {
            headers: { Authorization: FSQ_KEY },
            params: { fields: 'tel,website,hours,location' },
        });
        const d = detailRes.data;
        const result = {};
        if (d.tel)
            result.phone = d.tel;
        if (d.website)
            result.website = d.website;
        if (d.hours?.display?.length)
            result.opening_hours = d.hours.display.join('; ');
        if (d.location?.address)
            result['addr:street'] = d.location.address;
        enrichmentCache.set(cacheKey, result);
        return res.json(result);
    }
    catch {
        return res.json({});
    }
});
app.get('/auth/register', (req, res) => {
    res.status(405).json({ message: 'Use POST /auth/register to create a new account' });
});
app.post('/auth/register', async (req, res) => {
    const { email: rawEmail, username, password, factionId } = req.body;
    if (!rawEmail || !username || !password || !factionId) {
        return res.status(400).json({ error: 'email, username, password, and factionId are required' });
    }
    const email = rawEmail.toLowerCase().trim();
    const parsedFactionId = typeof factionId === 'number' && factionId > 0 ? factionId : null;
    try {
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
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
    }
    catch (error) {
        return res.status(500).json({ error: 'Registration failed', details: error instanceof Error ? error.message : undefined });
    }
});
app.post('/auth/login', async (req, res) => {
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
        const isMatch = await bcrypt_1.default.compare(password, user.password);
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
    }
    catch (error) {
        return res.status(500).json({ error: 'Login failed', details: error instanceof Error ? error.message : undefined });
    }
});
app.post('/territory/ownership', async (req, res) => {
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
        const hexScores = {};
        for (const venue of venues) {
            if (!hexScores[venue.h3Index]) {
                hexScores[venue.h3Index] = {};
            }
            for (const review of venue.reviews) {
                const factionId = review.user.factionId;
                if (factionId === null)
                    continue;
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
    }
    catch (error) {
        console.error('Error calculating territory ownership:', error);
        res.status(500).json({ error: 'Failed to calculate territory ownership' });
    }
});
// Mobile hex grid: client sends viewport bounds, server computes cells + ownership + boundaries.
// Removes the need for h3-js in the React Native / Hermes environment.
app.post('/territory/hexgrid', async (req, res) => {
    const { north, south, east, west, resolution = 9 } = req.body;
    if (north == null || south == null || east == null || west == null) {
        return res.status(400).json({ error: 'north, south, east, west required' });
    }
    const res9 = Math.min(Math.max(Number(resolution), 7), 11);
    const polygon = [
        [north, west], [north, east],
        [south, east], [south, west],
        [north, west],
    ];
    let hexIds;
    try {
        hexIds = h3.polygonToCells(polygon, res9);
    }
    catch {
        return res.status(400).json({ error: 'Invalid bounds' });
    }
    if (hexIds.length > 800) {
        return res.status(400).json({ error: 'Viewport too large — zoom in', tooLarge: true });
    }
    try {
        const venues = await prisma.venue.findMany({
            where: { h3Index: { in: hexIds } },
            select: {
                h3Index: true,
                reviews: { select: { rating: true, user: { select: { factionId: true } } } },
            },
        });
        const hexScores = {};
        for (const venue of venues) {
            if (!hexScores[venue.h3Index])
                hexScores[venue.h3Index] = {};
            for (const review of venue.reviews) {
                const factionId = review.user.factionId;
                if (factionId === null)
                    continue;
                hexScores[venue.h3Index][factionId] = (hexScores[venue.h3Index][factionId] ?? 0) + review.rating;
            }
        }
        const ownershipMap = {};
        for (const [h3Index, scores] of Object.entries(hexScores)) {
            let winner = null;
            let best = -1;
            for (const [idStr, score] of Object.entries(scores)) {
                if (score > best) {
                    best = score;
                    winner = parseInt(idStr, 10);
                }
            }
            ownershipMap[h3Index] = winner;
        }
        const result = hexIds.map(h3Index => {
            const boundary = h3.cellToBoundary(h3Index);
            return {
                h3Index,
                factionId: ownershipMap[h3Index] ?? null,
                boundary: boundary.map(([lat, lng]) => ({ latitude: lat, longitude: lng })),
            };
        });
        res.json(result);
    }
    catch {
        // DB unavailable — return all hexes as unclaimed so the grid still renders
        const result = hexIds.map(h3Index => {
            const boundary = h3.cellToBoundary(h3Index);
            return {
                h3Index,
                factionId: null,
                boundary: boundary.map(([lat, lng]) => ({ latitude: lat, longitude: lng })),
            };
        });
        res.json(result);
    }
});
app.get('/reviews/:venueName', async (req, res) => {
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
    }
    catch (error) {
        console.error('Error fetching reviews:', error);
        return res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});
app.post('/reviews', async (req, res) => {
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
    }
    catch (error) {
        console.error('Error creating review:', error);
        return res.status(500).json({ error: 'Failed to create review' });
    }
});
app.get('/factions', async (req, res) => {
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
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch factions' });
    }
});
app.post('/factions', async (req, res) => {
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
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to create faction', details: error instanceof Error ? error.message : undefined });
    }
});
app.post('/factions/:factionId/join', async (req, res) => {
    const factionId = parseInt(req.params.factionId, 10);
    if (isNaN(factionId))
        return res.status(400).json({ error: 'Invalid factionId' });
    const { userId } = req.body;
    if (!userId)
        return res.status(400).json({ error: 'userId is required' });
    try {
        const faction = await prisma.faction.findUnique({ where: { id: factionId } });
        if (!faction)
            return res.status(404).json({ error: 'Faction not found' });
        await prisma.user.update({ where: { id: userId }, data: { factionId } });
        return res.json({ success: true, factionId: faction.id, factionName: faction.name, factionColor: faction.color, factionIcon: faction.icon });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to join faction' });
    }
});
app.get('/factions/ranking', async (req, res) => {
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
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch faction ranking' });
    }
});
app.get('/factions/:factionId/members', async (req, res) => {
    const factionId = parseInt(req.params.factionId, 10);
    if (isNaN(factionId))
        return res.status(400).json({ error: 'Invalid factionId' });
    try {
        const members = await prisma.user.findMany({
            where: { factionId },
            select: { id: true, username: true, profilePicture: true, level: true, totalPoints: true },
            orderBy: { totalPoints: 'desc' },
        });
        return res.json(members);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch members' });
    }
});
app.get('/factions/:factionId/messages', async (req, res) => {
    const factionId = parseInt(req.params.factionId, 10);
    if (isNaN(factionId))
        return res.status(400).json({ error: 'Invalid factionId' });
    try {
        const messages = await prisma.message.findMany({
            where: { factionId },
            include: { user: { select: { username: true, profilePicture: true } } },
            orderBy: { createdAt: 'asc' },
            take: 50,
        });
        return res.json(messages);
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch messages' });
    }
});
app.post('/factions/:factionId/messages', async (req, res) => {
    const factionId = parseInt(req.params.factionId, 10);
    if (isNaN(factionId))
        return res.status(400).json({ error: 'Invalid factionId' });
    const { userId, content, type } = req.body;
    if (!userId || !content)
        return res.status(400).json({ error: 'userId and content are required' });
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
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to send message' });
    }
});
app.get('/users/:userId/profile', async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId))
        return res.status(400).json({ error: 'Invalid userId' });
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
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        // Streak: consecutive days with at least one first-ever venue discovery
        const allReviews = [...user.reviews].reverse(); // oldest first
        const firstDiscoveries = new Map();
        for (const review of allReviews) {
            if (!firstDiscoveries.has(review.venueId)) {
                firstDiscoveries.set(review.venueId, review.createdAt);
            }
        }
        const discoveryDays = new Set();
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
    }
    catch (error) {
        console.error('Error fetching profile:', error);
        return res.status(500).json({ error: 'Failed to fetch profile' });
    }
});
app.put('/users/:userId/profile-picture', async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId))
        return res.status(400).json({ error: 'Invalid userId' });
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
    }
    catch (error) {
        console.error('Error updating profile picture:', error);
        return res.status(500).json({ error: 'Failed to update profile picture' });
    }
});
// ── Mission template system ──────────────────────────────────────────────────
const MISSION_VENUES = [
    { venue: 'Galata Kulesi', status: 'Contested' },
    { venue: 'Taksim Meydanı', status: 'Under Attack' },
    { venue: 'Kadıköy Çarşı', status: 'Controlled by Red Reapers' },
    { venue: 'Mandabatmaz', status: 'Controlled by Blue Sentinels' },
    { venue: 'Kapalıçarşı Merkez', status: 'Controlled by Green Guardians' },
    { venue: 'Kronotrop Karaköy', status: 'Liberated' },
    { venue: 'İstanbul Modern Karaköy', status: 'Under Attack' },
    { venue: 'Nardis Jazz Club Galata', status: 'Contested' },
    { venue: 'Pera Müzesi Tepebaşı', status: 'Controlled by Red Reapers' },
    { venue: 'Emirgan Korusu', status: 'Liberated' },
    { venue: 'Topkapı Sarayı Müzesi', status: 'Contested' },
    { venue: 'Dolmabahçe Sarayı', status: 'Controlled by Blue Sentinels' },
    { venue: 'Beyazıt Meydanı', status: 'Under Attack' },
    { venue: '360 İstanbul Beyoğlu', status: 'Liberated' },
    { venue: 'Gezi Parkı Taksim', status: 'Controlled by Green Guardians' },
];
const COMMANDERS = [
    'NEXUS-ALPHA', 'PHANTOM-X', 'BLOOD-CIPHER', 'NOVA-REAPER', 'IRON-FANG',
    'SCARLET-PROTOCOL', 'SENTINEL-PRIME', 'GHOST-PROTOCOL', 'AZURE-HAWK',
    'VECTOR-7', 'CYBER-WARDEN', 'BINARY-STORM', 'ECO-TITAN', 'VERDE-CIPHER',
    'DARK-SIGNAL', 'OMEGA-NULL', 'NEON-EDGE', 'CIPHER-ZERO', 'STATIC-BLADE',
    'HEX-RUNNER', 'VOID-STRIKE', 'PULSE-WRAITH', 'SHADOW-KERNEL', 'FLUX-9',
];
const STATUS_TR = {
    'Controlled by Red Reapers': "Kızıl Biçiciler'in kontrolünde",
    'Controlled by Blue Sentinels': "Mavi Sentineller'in kontrolünde",
    'Controlled by Green Guardians': "Yeşil Koruyucular'ın kontrolünde",
    'Contested': 'çekişmeli bir bölge — iki rakip güç arasında kritik gerilim tırmanıyor',
    'Liberated': 'özgürleştirilmiş — kalıcı kontrol için acil destek gerekiyor',
    'Under Attack': 'ağır saldırı altında — savunma hatları çökmek üzere',
};
const BRIEFINGS = {
    'Controlled by Red Reapers': [
        'Kızıl Biçiciler bölgeye sinyal jammerları yerleştirmiş; iletişim kanalları bozulmuş durumda.',
        'İstihbarat raporları, düşmanın bölgeye şifreli komuta terminalleri kurduğunu doğruluyor.',
        'Kızıl fraksiyon bu noktayı lojistik merkez olarak kullanıyor — kritik hedef.',
        'Bölge dedektörleri aktif; tespit edilmeden hareket etmek için pencere daralıyor.',
    ],
    'Controlled by Blue Sentinels': [
        'Mavi Sentineller dronelarla bölgeyi izliyor; görünmez kalman giderek zorlaşıyor.',
        'Sentineller bölge altyapısını şifreli kilitlerle mühürlemiş; erişim kodu gerekli.',
        'Mavi komuta zinciri bu noktadan koordinasyon yapıyor — hedefe öncelik ver.',
        'Bölgedeki sivil örtü kırılmak üzere; operasyona hız kazandır.',
    ],
    'Controlled by Green Guardians': [
        'Yeşil Koruyucular bölgeyi eko-sensörlerle örüyor; her hareketi izliyorlar.',
        'Yeşil fraksiyon savunma ağı bu noktadan yönetiliyor — kritik bağlantı noktası.',
        'Guardians bu bölgeyi saha karargahı olarak kullanıyor; komuta düğümlerini hedef al.',
        'Yeşil Koruyucular çevre güvenlik perimetrini kapatıyor; süre daralıyor.',
    ],
    'Contested': [
        'İki fraksiyon arasındaki güç boşluğu bu noktayı kargaşaya sürüklüyor.',
        'Çatışma nedeniyle siviller tahliye edildi; bölge artık tam bir savaş alanı.',
        'Nötr heksagon olma özelliği yavaş yavaş kayboluyor; sahip çık yoksa rakip kazanır.',
        'Arka sokak bağlantıları kesilmiş; çatışma her an tırmanabilir.',
    ],
    'Liberated': [
        'Bölge ele geçirildi ancak düşman karşı atak için hazırlanıyor.',
        'Özgürleştirme sonrası altyapı hasarlı; acil onarım ve güçlendirme şart.',
        'Savunma düğümleri henüz tam kapasite çalışmıyor; açık vardır — kapat.',
        'Özgürleştirilmiş sektör, çevre heksagonlar stabilize edilmeden savunulamaz.',
    ],
    'Under Attack': [
        'Düşman dalgası hazırlıksız yakaladı; savunma perimetrinin yarısı çökmüş durumda.',
        'Saldırı koordineli geliyor; üç ayrı cepheden eş zamanlı baskı uygulanıyor.',
        'Saldırı dalgası ikinci fazına geçiyor; takviye yolda ama sen şimdi hareket etmelisin.',
        'Düşman sızma timi içeride — tespit et, etkisiz kıl, noktayı geri al.',
    ],
};
const OBJECTIVES_BY_STATUS = {
    'Controlled by Red Reapers': [
        ['Düşman sinyal jeneratörünü tespit et ve devre dışı bırak', 'Kızıl Biçiciler komuta ağını çökmek için H3 şifreleme anahtarını ele geçir', 'Bölgeden iz bırakmadan çekil ve konumunu güvenli kanaldan merkeze rapor et'],
        ['Sahte kimlikle içeri sız ve iç ağa bağlan', 'Kontrol paneli erişimini devral ve düşman veri yükünü merkeze aktar', 'Bölge kontrolünü teslim alarak kalıcı check-in yap'],
        ['Bölgedeki stratejik noktaları tara ve konum damgalı fotoğrafları aktar', 'Düşman operasyon dosyasına eriş ve yedek kopyayı çal', 'H3 indeksini yeniden yaz ve bölge kontrolünü fragsiyonumuza devret'],
    ],
    'Controlled by Blue Sentinels': [
        ['Drone gözetleme kör noktalarını haritalandır ve güvenli rota oluştur', 'Komuta terminaline ulaş ve şifreli erişim kodunu ele geçir', 'Sentineller kontrol şemasını sıfırla ve heksagonu devralmak için check-in yap'],
        ['Mavi fraksiyon sinyal ağını analiz ederek zayıf halkayı tespit et', 'Tespit edilen açıktan içeri gir ve veri paketini indir', 'Çıkış rotasını temizle ve bölge sahipliğini kayıt altına al'],
        ['Bölge güvenlik protokolünü devre dışı bırak', 'İç ağa bağlanarak operasyonel şifreli dosyaları ele geçir', 'Savunma düğümlerini kendi frekansımıza yeniden ayarla'],
    ],
    'Controlled by Green Guardians': [
        ['Guardians eko-sensör ağını kör et ve güvenli geçiş açıklığı oluştur', 'Kamuflajlı komuta üssüne sız ve şifreli koordinasyon verilerini indir', 'Bölge kontrolünü teslim al ve yeni savunma matrisini aktive et'],
        ['Biyolojik tarama sistemini atlatmak için frekans bozucu devreye al', 'Hedef noktadaki enerji düğümünü ele geçir ve kendi fraksiyon frekansına bağla', 'Bölge sınırlarını mühürle ve geri alma girişimlerine karşı savunmayı güçlendir'],
        ['Yeşil fraksiyon veri aktarım hattını kes ve trafiği yönlendir', 'Komuta ağına sızarak operasyon planlarını ele geçir ve merkeze ilet', 'Geri çekil; koordinatları kayıt altına al ve kalıcı işaret fenerini etkinleştir'],
    ],
    'Contested': [
        ['Çatışma hattına sız ve rakip fraksiyon aktarıcılarını tespit et', 'Sinyalleri birer birer kes ve bölge ağının kontrolünü ele geçir', 'Heksagon kontrolünü ilk ele geçiren taraf olarak check-in yap ve bölgeyi kilitle'],
        ['Nötr bölgede üstünlük kurmak için istihbarat noktalarını tara', 'İki rakip ajanı tespit et ve koordinatlarını kırmızı listeye ekle', 'H3 kilit kodunu sıfırla ve noktayı kendi fraksiyonuna devret'],
        ['Çekişmeli noktaya sız ve bölge altyapısına eriş', 'Şifreli ağ rotasyonunu kendi lehine yeniden yaz ve rakip erişimi kes', 'Rakip güçler toparlanmadan çekilme rotasını aç ve bölge transferini tamamla'],
    ],
    'Liberated': [
        ['Özgürleştirilmiş bölgeyi güçlendirmek için savunma düğümlerini aktive et', 'Çevre H3 heksagonlarını tara ve düşman karşı atak risklerini belirle', 'Yedek güç hatlarını bağla ve bölge ağını kalıcı olarak kilitle'],
        ['Bölge altyapısını sabitleştir ve hasar gören sistemleri onar', 'Düşman karşı atak hazırlığı tespit edilmeden savunma perimetrini güçlendir', 'Kalıcı check-in yap; fraksiyon bayrağını dijital olarak dik ve yayını başlat'],
        ['Bölge komuta ağını aktive et ve takviye birimlerle koordinasyon kur', 'Çevre heksagonlardaki tehditleri haritalandır ve savunma öncelik sıralamasını güncelle', 'Özgür bölgenin varlığını merkeze teyit et ve sürekli varlık sinyali ver'],
    ],
    'Under Attack': [
        ['Saldırı vektörünü analiz et ve öncelikli güvenlik açığını tespit et', 'Çöken savunma hattını yeniden kur ve kritik altyapı düğümlerini düşmandan kurtar', 'Son savunma pozisyonunu kilitle ve takviye gelene kadar H3 kontrol noktasını tut'],
        ['Acil: Düşman sızma koordinatlarını belirle ve geçiş noktalarını kapat', 'Savunma sistemlerini yeniden başlat ve bölge iletişim kanallarını şifrele', 'Tüm gizli operasyon verilerini kurtar ve güvenli sunucuya aktar'],
        ['Saldırı koordineli — üç cepheden gelen baskıyı analiz et ve önceliklendir', 'Operasyonel güvenlik ihlalini durdur ve tüm erişim kodlarını değiştir', 'Savunma hatlarını yeniden oluştur ve bölgeyi düşmana kaptırmadan check-in yap'],
    ],
};
const STATUS_POINTS = {
    'Under Attack': 200,
    'Contested': 150,
    'Controlled by Red Reapers': 120,
    'Controlled by Blue Sentinels': 120,
    'Controlled by Green Guardians': 120,
    'Liberated': 75,
};
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickRandom(arr, n) { return [...arr].sort(() => Math.random() - 0.5).slice(0, n); }
function missionPoints(status) { return STATUS_POINTS[status] ?? 100; }
function generateTemplateMission(venue, status, idx) {
    const commander = pick(COMMANDERS);
    const briefing = pick(BRIEFINGS[status] ?? BRIEFINGS['Contested']);
    const stepSet = pick(OBJECTIVES_BY_STATUS[status] ?? OBJECTIVES_BY_STATUS['Contested']);
    return {
        id: `mission-${idx}-${Date.now()}`,
        commander,
        venue,
        status,
        points: missionPoints(status),
        rawText: `[${commander} KOMUTANI]: ${venue} heksagonu şu an ${STATUS_TR[status] ?? status}. ${briefing}`,
        objectives: stepSet.map((text) => ({ text, done: false })),
    };
}
app.post('/missions/generate', async (req, res) => {
    const INFERENCE_URL = process.env.INFERENCE_URL || 'http://localhost:8000';
    const { lang } = req.body;
    const picks = pickRandom(MISSION_VENUES, 3);
    const missions = await Promise.all(picks.map(async ({ venue, status }, i) => {
        try {
            const r = await axios_1.default.post(`${INFERENCE_URL}/generate`, { venue, status, lang: lang || 'tr' }, { timeout: 30000 });
            if (r.data?.objectives?.length) {
                return { id: `mission-${i}-${Date.now()}`, points: missionPoints(status), ...r.data };
            }
            throw new Error('empty');
        }
        catch {
            return generateTemplateMission(venue, status, i);
        }
    }));
    return res.json({ missions });
});
const descriptionCache = new Map();
app.post('/venues/describe', async (req, res) => {
    const { name, amenity, cuisine, address, opening_hours, lang } = req.body;
    if (!name)
        return res.status(400).json({ error: 'name is required' });
    const cacheKey = `${name}::${lang || 'en'}`;
    if (descriptionCache.has(cacheKey)) {
        return res.json({ description: descriptionCache.get(cacheKey) });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
        return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });
    const venueType = cuisine ? `${amenity || 'venue'} (${cuisine.replace(/_/g, ' ')})` : (amenity || 'venue');
    let prompt;
    if (lang === 'tr') {
        const details = [
            address ? `Adres: ${address}` : null,
            opening_hours ? `Saatler: ${opening_hours}` : null,
        ].filter(Boolean).join(', ');
        prompt = `İstanbul'daki "${name}" adlı ${venueType} hakkında bilgilendirici 3-4 Türkçe cümle yaz.${details ? ` Bilinen bilgiler: ${details}.` : ''} Bu mekanın özellikleri, atmosferi ve ziyaretçilere ne sunduğu hakkında gerçekçi bilgi ver. Sadece düz metin yaz, başlık veya özel karakter kullanma.`;
    }
    else {
        const details = [
            address ? `Address: ${address}` : null,
            opening_hours ? `Hours: ${opening_hours}` : null,
        ].filter(Boolean).join(', ');
        prompt = `Write 3-4 informative sentences about "${name}", a ${venueType} in Istanbul, Turkey.${details ? ` Known details: ${details}.` : ''} Describe what the venue offers, its atmosphere, and what visitors can expect. Plain text only, no markdown, no bullet points, no special characters.`;
    }
    try {
        const apiRes = await axios_1.default.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1024 },
        }, { timeout: 30000 });
        const parts = apiRes.data?.candidates?.[0]?.content?.parts ?? [];
        const raw = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join(' ');
        const description = raw
            .replace(/^#+\s+.*$/gm, '') // # headings
            .replace(/\*\*([^*]*)\*\*/g, '$1') // **bold**
            .replace(/\*([^*]+)\*/g, '$1') // *italic*
            .replace(/^\s*[-*•]\s+/gm, '') // bullet points
            .replace(/`[^`]+`/g, '') // inline code
            .replace(/_{1,2}([^_]+)_{1,2}/g, '$1') // __underline__
            .replace(/\n{2,}/g, ' ')
            .replace(/\n/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
        descriptionCache.set(cacheKey, description);
        return res.json({ description });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('Gemini API error:', msg);
        return res.status(500).json({ error: 'Failed to generate description', detail: msg });
    }
});
if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}
exports.default = app;
//# sourceMappingURL=index.js.map