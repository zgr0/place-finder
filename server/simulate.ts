/**
 * simulate.ts — populate DB with factions, users, venues, and reviews
 * to produce colored territory hexes in the Kadıköy area.
 *
 * Usage: npx ts-node simulate.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as h3 from 'h3-js';
import * as bcrypt from 'bcrypt';

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://user:qwe123asd@localhost:5432/placefinder_db?schema=public';
const adapter = new PrismaPg({ connectionString: DB_URL });
const prisma = new PrismaClient({ adapter });

// Default factions — created if they don't exist
const DEFAULT_FACTIONS = [
  { name: 'Kızıl Biçiciler',   color: '#FF3333', icon: '⚔️',  description: 'Şehrin kızıl savaşçıları. Kadıköy sokaklarında hüküm sürerler.' },
  { name: 'Mavi Sentineller',  color: '#3366FF', icon: '🛡️', description: 'İstanbul\'un mavi bekçileri. Sahil hattını kontrol altında tutarlar.' },
  { name: 'Yeşil Koruyucular', color: '#22CC44', icon: '🌿', description: 'Şehrin yeşil kalkanı. Parkları ve doğal alanları ellerinde bulundururlar.' },
];

// Kadıköy-area venues: [name, category, lat, lng]
const VENUES: [string, string, number, number][] = [
  ['Moda Kafe',                'cafe',     40.9882, 29.0267],
  ['Bağdat Caddesi Kitabevi',  'library',  40.9762, 29.0541],
  ['Kadıköy Çarşı',            'market',   40.9901, 29.0280],
  ['Yeldeğirmeni Sanat',       'art',      40.9945, 29.0337],
  ['Moda Sahil Parkı',         'park',     40.9831, 29.0189],
  ['Fenerbahçe Parkı',         'park',     40.9683, 29.0376],
  ['Kalamış Marina',           'marina',   40.9732, 29.0432],
  ['Hasanpaşa Fırını',         'bakery',   40.9915, 29.0298],
  ['Özgür Kafe',               'cafe',     40.9866, 29.0311],
  ['Tarihi Çarşı Büfe',        'food',     40.9909, 29.0271],
  ['Acıbadem Kafe',            'cafe',     40.9791, 29.0489],
  ['Suadiye Plajı',            'beach',    40.9614, 29.0679],
  ['Bostancı İskele',          'dock',     40.9601, 29.0843],
  ['Göztepe Parkı',            'park',     40.9744, 29.0601],
  ['Erenköy Kafe',             'cafe',     40.9691, 29.0522],
  ['Moda Deniz Kulübü',        'sports',   40.9815, 29.0212],
  ['Bahariye Caddesi',         'shopping', 40.9924, 29.0291],
  ['Altıyol Meydanı',          'square',   40.9897, 29.0262],
  ['Haydarpaşa Garı',          'station',  40.9997, 29.0199],
  ['Üsküdar İskele',           'dock',     41.0234, 29.0139],
];

// Civilian users — no faction, simulate real registered users
const CIVILIAN_USERS = [
  { username: 'ayse_explorer',   email: 'ayse@sim.local' },
  { username: 'mehmet_wanderer', email: 'mehmet@sim.local' },
  { username: 'zeynep_tourist',  email: 'zeynep@sim.local' },
];

const USERS_PER_FACTION = 5;
const REVIEWS_PER_USER  = 6;
const RESOLUTION        = 9;

async function ensureFactions() {
  console.log('\nEnsuring factions exist...');
  const result = [];
  for (const f of DEFAULT_FACTIONS) {
    const existing = await prisma.faction.findFirst({ where: { name: f.name } });
    if (existing) {
      console.log(`  (exists) ${f.name}`);
      result.push(existing);
    } else {
      const created = await prisma.faction.create({ data: f });
      console.log(`  Created  ${f.name} (id=${created.id})`);
      result.push(created);
    }
  }
  return result;
}

async function ensureVenues() {
  console.log('\nEnsuring venues exist...');
  const created: { id: number; h3Index: string }[] = [];
  for (const [name, category, lat, lng] of VENUES) {
    const h3Index = h3.latLngToCell(lat, lng, RESOLUTION);
    const existing = await prisma.venue.findFirst({ where: { h3Index, name } });
    if (existing) {
      created.push({ id: existing.id, h3Index });
      console.log(`  (exists) ${name} → ${h3Index}`);
      continue;
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Venue" ("name","category","h3Index","location")
       VALUES ($1,$2,$3, ST_SetSRID(ST_MakePoint($4,$5),4326))`,
      name, category, h3Index, lng, lat,
    );
    const v = await prisma.venue.findFirst({ where: { h3Index, name } });
    if (v) {
      created.push({ id: v.id, h3Index });
      console.log(`  Created  ${name} → ${h3Index}`);
    }
  }
  return created;
}

async function main() {
  const factions = await ensureFactions();
  console.log(`\nFactions: ${factions.map(f => `${f.name} (id=${f.id})`).join(', ')}`);

  const allVenues = await ensureVenues();

  const hashedPw  = await bcrypt.hash('simulate123', 10);
  let totalReviews = 0;

  // ── Civilian users (no faction) ───────────────────────────────────────────
  console.log('\nCreating civilian users (no faction)...');
  for (const { username, email } of CIVILIAN_USERS) {
    let user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      user = await prisma.user.create({
        data: { username, email, password: hashedPw },  // factionId omitted → null
      });
      console.log(`  Created  ${username} (no faction)`);
    } else {
      console.log(`  (exists) ${username}`);
    }

    // Civilians write a few scattered reviews across all venues
    const civilianVenues = allVenues.filter((_, i) => i % 4 === 0);
    for (const venue of civilianVenues.slice(0, 3)) {
      const exists = await prisma.review.findFirst({ where: { userId: user.id, venueId: venue.id } });
      if (!exists) {
        await prisma.review.create({
          data: { userId: user.id, venueId: venue.id, rating: 3, content: `Genel izlenim — ${username}` },
        });
        totalReviews++;
      }
    }
  }

  // ── Faction bot users ─────────────────────────────────────────────────────
  for (const faction of factions) {
    console.log(`\nCreating bot users for: ${faction.name}`);
    const factionIdx = factions.indexOf(faction);
    const start = factionIdx * Math.floor(VENUES.length / factions.length);
    const end   = Math.min(start + Math.floor(VENUES.length / factions.length) + 2, VENUES.length);
    const myVenues = allVenues.slice(start, end);

    for (let i = 1; i <= USERS_PER_FACTION; i++) {
      const username = `bot_${faction.name.toLowerCase().replace(/\s+/g, '_')}_${i}`;
      const email    = `${username}@sim.local`;

      let user = await prisma.user.findUnique({ where: { username } });
      if (!user) {
        user = await prisma.user.create({
          data: { username, email, password: hashedPw, factionId: faction.id },
        });
        console.log(`  Created  ${username}`);
      } else {
        if (user.factionId !== faction.id) {
          await prisma.user.update({ where: { id: user.id }, data: { factionId: faction.id } });
        }
        console.log(`  (exists) ${username}`);
      }

      for (let r = 0; r < REVIEWS_PER_USER && r < myVenues.length; r++) {
        const venue = myVenues[r % myVenues.length];
        const exists = await prisma.review.findFirst({ where: { userId: user.id, venueId: venue.id } });
        if (!exists) {
          await prisma.review.create({
            data: { userId: user.id, venueId: venue.id, rating: 4 + (r % 2), content: `Sim review by ${username}` },
          });
          totalReviews++;
        }
      }
    }
  }

  console.log(`\n✓ Done.`);
  console.log(`  Venues : ${allVenues.length}`);
  console.log(`  Reviews: ${totalReviews} new`);
  console.log(`  Factions: ${factions.length} (${factions.map(f => f.name).join(', ')})`);
  console.log(`  Civilian users: ${CIVILIAN_USERS.length} (no faction)`);
  console.log('\nReload /hex — colored territory should appear in Kadıköy area.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
