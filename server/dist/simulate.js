"use strict";
/**
 * simulate.ts — populate DB with fake users, venues, and reviews
 * to produce colored territory hexes in the Kadıköy area.
 *
 * Usage: npx ts-node simulate.ts
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const h3 = __importStar(require("h3-js"));
const bcrypt = __importStar(require("bcrypt"));
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://user:qwe123asd@localhost:5432/placefinder_db?schema=public';
const adapter = new adapter_pg_1.PrismaPg({ connectionString: DB_URL });
const prisma = new client_1.PrismaClient({ adapter });
// Kadıköy-area venues: [name, category, lat, lng]
const VENUES = [
    ['Moda Kafe', 'cafe', 40.9882, 29.0267],
    ['Bağdat Caddesi Kitabevi', 'library', 40.9762, 29.0541],
    ['Kadıköy Çarşı', 'market', 40.9901, 29.0280],
    ['Yeldeğirmeni Sanat', 'art', 40.9945, 29.0337],
    ['Moda Sahil Parkı', 'park', 40.9831, 29.0189],
    ['Fenerbahçe Parkı', 'park', 40.9683, 29.0376],
    ['Kalamış Marina', 'marina', 40.9732, 29.0432],
    ['Hasanpaşa Fırını', 'bakery', 40.9915, 29.0298],
    ['Özgür Kafe', 'cafe', 40.9866, 29.0311],
    ['Tarihi Çarşı Büfe', 'food', 40.9909, 29.0271],
    ['Acıbadem Kafe', 'cafe', 40.9791, 29.0489],
    ['Suadiye Plajı', 'beach', 40.9614, 29.0679],
    ['Bostancı İskele', 'dock', 40.9601, 29.0843],
    ['Göztepe Parkı', 'park', 40.9744, 29.0601],
    ['Erenköy Kafe', 'cafe', 40.9691, 29.0522],
    ['Moda Deniz Kulübü', 'sports', 40.9815, 29.0212],
    ['Bahariye Caddesi', 'shopping', 40.9924, 29.0291],
    ['Altıyol Meydanı', 'square', 40.9897, 29.0262],
    ['Haydarpaşa Garı', 'station', 40.9997, 29.0199],
    ['Üsküdar İskele', 'dock', 41.0234, 29.0139],
];
// How many bot users per faction
const USERS_PER_FACTION = 5;
const REVIEWS_PER_USER = 6;
const RESOLUTION = 9;
async function main() {
    console.log('Fetching factions...');
    const factions = await prisma.faction.findMany({ orderBy: { id: 'asc' } });
    if (factions.length === 0) {
        console.error('No factions found. Run the server at least once to seed them.');
        process.exit(1);
    }
    console.log(`Found ${factions.length} factions: ${factions.map(f => f.name).join(', ')}`);
    // Create venues
    console.log('\nCreating venues...');
    const createdVenues = [];
    for (const [name, category, lat, lng] of VENUES) {
        const h3Index = h3.latLngToCell(lat, lng, RESOLUTION);
        const existing = await prisma.venue.findFirst({ where: { h3Index, name } });
        if (existing) {
            createdVenues.push({ id: existing.id, h3Index });
            console.log(`  (exists) ${name} → ${h3Index}`);
            continue;
        }
        const venue = await prisma.$executeRawUnsafe(`INSERT INTO "Venue" ("name","category","h3Index","location") VALUES ($1,$2,$3,'') RETURNING id`, name, category, h3Index);
        // Re-fetch to get id
        const v = await prisma.venue.findFirst({ where: { h3Index, name } });
        if (v) {
            createdVenues.push({ id: v.id, h3Index });
            console.log(`  Created ${name} → ${h3Index}`);
        }
    }
    // Create bot users and reviews
    const hashedPw = await bcrypt.hash('simulate123', 10);
    let totalReviews = 0;
    for (const faction of factions) {
        console.log(`\nCreating users for faction: ${faction.name}`);
        for (let i = 1; i <= USERS_PER_FACTION; i++) {
            const username = `bot_${faction.name.toLowerCase().replace(/\s+/g, '_')}_${i}`;
            const email = `${username}@sim.local`;
            let user = await prisma.user.findUnique({ where: { username } });
            if (!user) {
                user = await prisma.user.create({
                    data: { username, email, password: hashedPw, factionId: faction.id },
                });
                console.log(`  Created user: ${username}`);
            }
            else {
                // Ensure user is in this faction
                if (user.factionId !== faction.id) {
                    await prisma.user.update({ where: { id: user.id }, data: { factionId: faction.id } });
                }
                console.log(`  (exists) ${username}`);
            }
            // Assign venues to this user biased toward faction index
            // Faction 0 → venues 0-6, faction 1 → venues 7-13, faction 2 → venues 14-19
            const factionIdx = factions.indexOf(faction);
            const start = factionIdx * Math.floor(VENUES.length / factions.length);
            const end = Math.min(start + Math.floor(VENUES.length / factions.length) + 2, VENUES.length);
            const myVenues = createdVenues.slice(start, end);
            for (let r = 0; r < REVIEWS_PER_USER && r < myVenues.length; r++) {
                const venue = myVenues[r % myVenues.length];
                const existing = await prisma.review.findFirst({
                    where: { userId: user.id, venueId: venue.id },
                });
                if (!existing) {
                    await prisma.review.create({
                        data: { userId: user.id, venueId: venue.id, rating: 4 + (r % 2), content: `Sim review by ${username}` },
                    });
                    totalReviews++;
                }
            }
        }
    }
    console.log(`\nDone. Created/verified ${createdVenues.length} venues, ${totalReviews} new reviews.`);
    console.log('Reload the hex map — colored territory should appear in Kadıköy area.');
}
main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=simulate.js.map