/**
 * simulate_battle.js — Comprehensive stress & battle simulation
 
 * Usage:
 *   node simulate_battle.js
 *
 * Env overrides:
 *   SIM_BASE_URL=http://localhost:3000   (default)
 *   SIM_USERS=10        users per faction (default 10)
 *   SIM_CONCURRENCY=20  parallel workers  (default 20)
 *   SIM_DURATION=60     seconds to run    (default 60)
 */

require('dotenv').config();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// ─── Config ───────────────────────────────────────────────────────────────────

const CFG = {
  baseUrl: process.env.SIM_BASE_URL || 'http://localhost:3000',
  usersPerFaction: parseInt(process.env.SIM_USERS || '10'),
  concurrency: parseInt(process.env.SIM_CONCURRENCY || '20'),
  durationMs: parseInt(process.env.SIM_DURATION || '60') * 1000,
  statsIntervalMs: 10_000,
  axiosTimeout: 8_000,
};

// Weighted action pool per archetype
// power = aggressive reviewer, casual = balanced, lurker = chat-heavy
const ARCHETYPES = {
  power: { review: 0.65, chat: 0.20, territory: 0.10, profile: 0.05, thinkMs: [20, 200] },
  casual: { review: 0.45, chat: 0.35, territory: 0.12, profile: 0.08, thinkMs: [100, 600] },
  lurker: { review: 0.15, chat: 0.70, territory: 0.08, profile: 0.07, thinkMs: [300, 1200] },
};
const ARCHETYPE_DIST = ['power', 'power', 'power', 'casual', 'casual', 'casual', 'casual', 'casual', 'lurker', 'lurker'];

// ─── Content pools ────────────────────────────────────────────────────────────

const REVIEW_TEXTS = [
  'Solid spot, faction territory secured.',
  'Claiming this hex for our faction!',
  'Great vibes here, we own this block.',
  'Rival faction spotted — we hit back harder.',
  'Amazing place, definitely worth the points.',
  'Love the atmosphere here. 10/10.',
  'This venue is ours now.',
  'Top-tier location for our operations.',
  'Quick recon — marking territory.',
  'Strong coffee, stronger faction presence.',
  'Checked in and claiming the hex grid.',
  'Our faction dominates this area.',
  'First visit but not the last — ours.',
  'Solid base of operations.',
  'Nothing special but the hex is ours now.',
  null, null, null, // ~15% no content
];

const CHAT_MSGS = [
  'We are taking over the east side!',
  'Anyone near Kadıköy? Need backup.',
  'Just reviewed 3 venues in a row 🔥',
  'Enemy faction gaining on hex 89c...',
  'Push harder on the waterfront venues!',
  'Good work team, keep the pressure up.',
  'Who is closest to the market area?',
  'Dropping 5-stars everywhere, let\'s GO.',
  'Lost a hex — regroup and review!',
  'Our total points just passed 1000!',
  'They can\'t beat us if we coordinate.',
  'Focus on high-traffic venues today.',
  'Quick status: 3 hexes gained this hour.',
  'Keep reviewing, territory doesn\'t hold itself.',
  'I\'m offline soon, cover the café district.',
];

// ─── Stats tracker ────────────────────────────────────────────────────────────

class Stats {
  constructor() {
    this.start = Date.now();
    this.ops = { review: 0, chat: 0, territory: 0, profile: 0 };
    this.errs = { review: 0, chat: 0, territory: 0, profile: 0 };
    this.latencies = [];           // all latencies (ms)
    this.errMsgs = {};             // error message → count
    this.factionReviews = {};      // factionId → review count
    this.timestamps = [];          // op timestamps for rolling req/sec
    this.peakRps = 0;
    this._lastRpsWindow = [];
  }

  record(action, latencyMs, ok, errMsg) {
    const now = Date.now();
    if (ok) {
      this.ops[action] = (this.ops[action] || 0) + 1;
    } else {
      this.errs[action] = (this.errs[action] || 0) + 1;
      if (errMsg) this.errMsgs[errMsg] = (this.errMsgs[errMsg] || 0) + 1;
    }
    this.latencies.push(latencyMs);
    this.timestamps.push(now);

    // Rolling 1-second window for peak rps
    this._lastRpsWindow.push(now);
    const cutoff = now - 1000;
    this._lastRpsWindow = this._lastRpsWindow.filter(t => t > cutoff);
    if (this._lastRpsWindow.length > this.peakRps) this.peakRps = this._lastRpsWindow.length;
  }

  recordFactionReview(factionId) {
    this.factionReviews[factionId] = (this.factionReviews[factionId] || 0) + 1;
  }

  totalOps() { return Object.values(this.ops).reduce((a, b) => a + b, 0); }
  totalErrs() { return Object.values(this.errs).reduce((a, b) => a + b, 0); }

  rps() {
    const elapsed = (Date.now() - this.start) / 1000;
    return elapsed > 0 ? (this.totalOps() / elapsed).toFixed(1) : '0.0';
  }

  percentile(p) {
    if (!this.latencies.length) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * p / 100);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  printPeriodic(factions) {
    const total = this.totalOps();
    const errs = this.totalErrs();
    const errPct = total + errs > 0 ? ((errs / (total + errs)) * 100).toFixed(1) : '0.0';
    const elapsed = ((Date.now() - this.start) / 1000).toFixed(1);

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`⏱  ${elapsed}s elapsed`);
    console.log(`📊 Total: ${total} ops | Errors: ${errs} (${errPct}%) | Avg ${this.rps()} ops/sec | Peak ${this.peakRps} ops/sec`);
    console.log(`⚡ Latency — p50: ${this.percentile(50)}ms  p95: ${this.percentile(95)}ms  p99: ${this.percentile(99)}ms  max: ${Math.max(...this.latencies, 0)}ms`);
    console.log(`🎯 Actions — reviews: ${this.ops.review}  chat: ${this.ops.chat}  territory: ${this.ops.territory}  profile: ${this.ops.profile}`);
    console.log(`❌ Errors  — reviews: ${this.errs.review}  chat: ${this.errs.chat}  territory: ${this.errs.territory}  profile: ${this.errs.profile}`);

    if (Object.keys(this.factionReviews).length > 0 && factions.length > 0) {
      const ranked = [...factions].sort((a, b) =>
        (this.factionReviews[b.id] || 0) - (this.factionReviews[a.id] || 0)
      );
      const lines = ranked.map((f, i) => {
        const count = this.factionReviews[f.id] || 0;
        const bar = '█'.repeat(Math.min(Math.round(count / 2), 20));
        const medal = i === 0 ? '🏆' : i === 1 ? '🥈' : '🥉';
        return `   ${medal} ${f.name.padEnd(20)} ${String(count).padStart(4)} reviews  ${bar}`;
      });
      console.log(`🏴 Faction Battle:\n${lines.join('\n')}`);
    }
  }

  printFinal(factions, users) {
    const total = this.totalOps();
    const errs = this.totalErrs();
    const errPct = total + errs > 0 ? ((errs / (total + errs)) * 100).toFixed(1) : '0.0';
    const elapsed = ((Date.now() - this.start) / 1000).toFixed(1);
    const maxLat = this.latencies.length ? Math.max(...this.latencies) : 0;
    const minLat = this.latencies.length ? Math.min(...this.latencies) : 0;

    console.log(`\n${'═'.repeat(60)}`);
    console.log('🏁  FINAL BATTLE REPORT');
    console.log(`${'═'.repeat(60)}`);
    console.log(`Duration   : ${elapsed}s`);
    console.log(`Workers    : ${CFG.concurrency} concurrent simulated users`);
    console.log(`Total ops  : ${total.toLocaleString()} (${errPct}% error rate)`);
    console.log(`Throughput : ${this.rps()} ops/sec avg  |  ${this.peakRps} ops/sec peak`);
    console.log('');
    console.log('Latency Distribution:');
    console.log(`  min: ${minLat}ms  |  p50: ${this.percentile(50)}ms  |  p75: ${this.percentile(75)}ms`);
    console.log(`  p90: ${this.percentile(90)}ms  |  p95: ${this.percentile(95)}ms  |  p99: ${this.percentile(99)}ms  |  max: ${maxLat}ms`);
    console.log('');
    console.log('Per-Action Breakdown:');
    const actions = ['review', 'chat', 'territory', 'profile'];
    for (const a of actions) {
      const ok = this.ops[a] || 0;
      const er = this.errs[a] || 0;
      console.log(`  ${a.padEnd(12)} ${String(ok).padStart(5)} ok  ${String(er).padStart(4)} err`);
    }
    console.log('');

    if (Object.keys(this.errMsgs).length > 0) {
      console.log('Top Errors:');
      Object.entries(this.errMsgs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([msg, count]) => console.log(`  [${count}x] ${msg.slice(0, 80)}`));
      console.log('');
    }

    if (factions.length > 0) {
      console.log('Faction Battle Results:');
      const ranked = [...factions].sort((a, b) =>
        (this.factionReviews[b.id] || 0) - (this.factionReviews[a.id] || 0)
      );
      ranked.forEach((f, i) => {
        const count = this.factionReviews[f.id] || 0;
        const label = i === 0 ? ' ← TERRITORY LEADER 🏆' : '';
        console.log(`  ${['🥇', '🥈', '🥉'][i] || ' '} ${f.name.padEnd(22)} ${count} reviews${label}`);
      });
      console.log('');
    }

    console.log(`Users simulated: ${users.length}`);
    const archetypeCounts = users.reduce((acc, u) => { acc[u.archetype] = (acc[u.archetype] || 0) + 1; return acc; }, {});
    console.log(`  Power users: ${archetypeCounts.power || 0}  Casual: ${archetypeCounts.casual || 0}  Lurkers: ${archetypeCounts.lurker || 0}`);
    console.log(`${'═'.repeat(60)}`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const http = axios.create({ baseURL: CFG.baseUrl, timeout: CFG.axiosTimeout });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function thinkTime(archetype) {
  const [lo, hi] = ARCHETYPES[archetype].thinkMs;
  return randInt(lo, hi);
}

function pickAction(archetype) {
  const weights = ARCHETYPES[archetype];
  const r = Math.random();
  let cum = 0;
  for (const [action, w] of Object.entries(weights)) {
    if (action === 'thinkMs') continue;
    cum += w;
    if (r < cum) return action;
  }
  return 'review';
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function apiReview(user, venues) {
  const venue = rand(venues);
  const rating = user.archetype === 'power'
    ? randInt(3, 5)                    // power users rate higher (competitive)
    : randInt(1, 5);
  const content = rand(REVIEW_TEXTS);
  await http.post('/reviews', {
    userId: user.id,
    venueName: venue,
    rating,
    content,
  });
  return { factionId: user.factionId };
}

async function apiChat(user) {
  if (!user.factionId) return;
  const content = rand(CHAT_MSGS);
  await http.post(`/factions/${user.factionId}/messages`, {
    userId: user.id,
    content,
    type: 'text',
  });
}

async function apiTerritory(hexIds) {
  // Sample random hex IDs to simulate a viewport query
  const sample = hexIds.slice(0, randInt(20, 60));
  await http.post('/territory/ownership', { hexIds: sample });
}

async function apiProfile(user) {
  await http.get(`/users/${user.id}/profile`);
}

// ─── Setup ────────────────────────────────────────────────────────────────────

async function ensureFactions() {
  const { data } = await http.get('/factions');
  if (data.length > 0) {
    console.log(`✓ Found ${data.length} existing factions`);
    return data;
  }

  console.log('No factions found — creating 3 test factions...');
  const templates = [
    { name: 'Red Dragons', color: '#ef4444', icon: '🐉', description: 'Aggressive territorial dominators' },
    { name: 'Blue Storm', color: '#3b82f6', icon: '⚡', description: 'Speed and coordination' },
    { name: 'Green Warden', color: '#22c55e', icon: '🌿', description: 'Patient explorers, deep roots' },
  ];
  const created = [];
  for (const t of templates) {
    const { data } = await http.post('/factions', t);
    created.push(data);
    console.log(`  Created faction: ${t.name} (id=${data.id})`);
  }
  return created;
}

async function registerOrLogin(email, username, password, factionId) {
  try {
    const { data } = await http.post('/auth/register', { email, username, password, factionId });
    return data;
  } catch (err) {
    if (err.response?.status === 500 && err.response?.data?.details?.includes('Unique constraint')) {
      // already exists — login
      const { data } = await http.post('/auth/login', { email, password });
      return data;
    }
    throw err;
  }
}

async function loadVenueNames() {
  // Load from DB directly — avoids the GeoJSON file/DB name mismatch
  // (GET /venues reads cafe.geojson; POST /reviews queries the DB → different sets)
  const dbUrl = process.env.DATABASE_URL.replace('@db:5432', '@localhost:5432');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }) });
  try {
    const rows = await prisma.venue.findMany({ select: { name: true } });
    const unique = [...new Set(rows.map(r => r.name).filter(Boolean))];
    console.log(`✓ Loaded ${unique.length} unique venue names from DB`);
    return unique;
  } finally {
    await prisma.$disconnect();
  }
}

// Fake H3 hex IDs that roughly cover Kadıköy area (for territory queries)
function generateHexIds(count = 200) {
  // Real H3 res-9 indices around 40.9882, 29.0267 would be computed via h3-js.
  // For simulation we generate plausible-looking strings — server will just get empty results
  // but the endpoint, parsing, and DB query still get exercised under load.
  const BASE = '8928308';
  const ids = new Set();
  while (ids.size < count) {
    const suffix = Math.floor(Math.random() * 0xFFFFF).toString(16).padStart(5, '0');
    ids.add(`${BASE}${suffix}fffffff`);
  }
  return [...ids];
}

// ─── Worker ───────────────────────────────────────────────────────────────────

async function worker(user, venues, hexIds, stats, stopSignal) {
  while (!stopSignal.stop) {
    const action = pickAction(user.archetype);
    const t0 = Date.now();
    try {
      if (action === 'review') {
        const result = await apiReview(user, venues);
        stats.recordFactionReview(result.factionId);
      } else if (action === 'chat') {
        await apiChat(user);
      } else if (action === 'territory') {
        await apiTerritory(hexIds);
      } else if (action === 'profile') {
        await apiProfile(user);
      }
      stats.record(action, Date.now() - t0, true);
    } catch (err) {
      const msg = err.response
        ? `HTTP ${err.response.status} ${action}`
        : err.code || err.message || 'unknown';
      stats.record(action, Date.now() - t0, false, msg);
    }
    await sleep(thinkTime(user.archetype));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     Place Finder — Battle Simulation         ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`Target  : ${CFG.baseUrl}`);
  console.log(`Users   : ${CFG.usersPerFaction} per faction`);
  console.log(`Workers : ${CFG.concurrency} concurrent`);
  console.log(`Duration: ${CFG.durationMs / 1000}s`);
  console.log('');

  // 1. Load factions
  let factions;
  try {
    factions = await ensureFactions();
  } catch (err) {
    console.error('✗ Cannot reach server:', err.message);
    console.error('  Make sure the server is running: npm run dev');
    process.exit(1);
  }

  // 2. Load venues
  const venues = await loadVenueNames();
  if (venues.length === 0) {
    console.error('✗ No venues in DB. Seed venues first.');
    process.exit(1);
  }

  // 3. Generate hex ID pool for territory queries
  const hexIds = generateHexIds(300);

  // 4. Register/login users
  console.log('\nRegistering users...');
  const users = [];
  const SIM_PASS = 'SimPass123!';
  const RUN_ID = Date.now().toString(36); // unique per run → avoid username clashes

  for (const faction of factions) {
    for (let i = 0; i < CFG.usersPerFaction; i++) {
      const archetype = ARCHETYPE_DIST[i % ARCHETYPE_DIST.length];
      const username = `sim_${RUN_ID}_f${faction.id}_u${i}`;
      const email = `${username}@sim.local`;
      try {
        const data = await registerOrLogin(email, username, SIM_PASS, faction.id);
        users.push({
          id: data.id,
          username,
          factionId: faction.id,
          archetype,
        });
      } catch (err) {
        console.warn(`  ⚠ Could not create ${username}: ${err.message}`);
      }
    }
    process.stdout.write(`  Faction "${faction.name}": ${CFG.usersPerFaction} users ready\n`);
  }

  if (users.length === 0) {
    console.error('✗ No users created. Aborting.');
    process.exit(1);
  }

  // Respect concurrency cap — pool the users
  const workers = users.slice(0, CFG.concurrency);
  console.log(`\n✓ ${users.length} users registered — running ${workers.length} concurrent workers`);
  console.log(`\nBattle starts now! Running for ${CFG.durationMs / 1000} seconds...\n`);

  // 5. Stats + stop signal
  const stats = new Stats();
  const stopSignal = { stop: false };

  // 6. Periodic stats printer
  const statsTimer = setInterval(() => {
    stats.printPeriodic(factions);
  }, CFG.statsIntervalMs);

  // 7. Launch workers
  const workerPromises = workers.map(u =>
    worker(u, venues, hexIds, stats, stopSignal)
  );

  // 8. Stop after duration
  await sleep(CFG.durationMs);
  stopSignal.stop = true;
  clearInterval(statsTimer);

  await Promise.allSettled(workerPromises);

  // 9. Final report
  stats.printFinal(factions, users);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
