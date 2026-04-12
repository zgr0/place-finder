"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const parser_1 = require("./parser");
if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set in environment variables');
}
const app = (0, express_1.default)();
const adapter = new adapter_pg_1.PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new client_1.PrismaClient({ adapter });
const port = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/venues', (req, res) => {
    try {
        const venues = (0, parser_1.parseCafeGeoJson)();
        res.json(venues);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to parse venues' });
    }
});
app.get('/auth/register', (req, res) => {
    res.status(405).json({ message: 'Use POST /auth/register to create a new account' });
});
app.post('/auth/register', async (req, res) => {
    const { email, username, password, factionId } = req.body;
    if (!email || !username || !password || typeof factionId !== 'number') {
        return res.status(400).json({ error: 'email, username, password, and factionId are required' });
    }
    try {
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                username,
                password: hashedPassword,
                factionId,
            },
        });
        return res.status(201).json({ id: user.id, email: user.email, username: user.username, factionId: user.factionId });
    }
    catch (error) {
        return res.status(500).json({ error: 'Registration failed', details: error instanceof Error ? error.message : undefined });
    }
});
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required' });
    }
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const isMatch = await bcrypt_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        return res.status(200).json({ id: user.id, username: user.username, factionId: user.factionId });
    }
    catch (error) {
        return res.status(500).json({ error: 'Login failed', details: error instanceof Error ? error.message : undefined });
    }
});
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
//# sourceMappingURL=index.js.map