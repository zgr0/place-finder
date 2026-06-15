/**
 * Batch venue enrichment:
 *   - MapTiler reverse geocoding → address fields (uses existing MAPTILER_KEY)
 *   - Foursquare Places API v3   → phone, website, hours (needs valid fsq3... key)
 *
 * Usage:
 *   npx ts-node enrich-venues.ts                  # addresses only
 *   npx ts-node enrich-venues.ts --full            # addresses + Foursquare
 *   npx ts-node enrich-venues.ts --limit 100       # cap at 100 venues
 *   npx ts-node enrich-venues.ts --dry-run         # preview, no writes
 *
 * Foursquare free key: https://developer.foursquare.com/ → create project → copy "API Key" (starts with fsq3)
 */

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const MAPTILER_KEY = process.env.API_KEY || process.env.MAPTILER_KEY;
const FSQ_KEY = process.env.FSQ_API_KEY;
const GEOJSON_PATH = join(__dirname, 'src', 'cafe.geojson');

const args = process.argv.slice(2);
const limitArg = args.indexOf('--limit');
const LIMIT = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : Infinity;
const DRY_RUN = args.includes('--dry-run');
const FULL = args.includes('--full');
const MAPTILER_DELAY = 250;
const FSQ_DELAY = 300;

interface GeoJsonFeature {
  type: 'Feature';
  id?: string;
  properties: Record<string, any>;
  geometry: { type: string; coordinates: number[] };
}

function needsAddress(props: Record<string, any>) {
  return !props['addr:street'];
}

function needsFoursquare(props: Record<string, any>) {
  return !props.phone || !props.website || !props.opening_hours;
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function reverseGeocode(lng: number, lat: number): Promise<Record<string, any>> {
  const url = `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${MAPTILER_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MapTiler ${res.status}`);
  const data = await res.json() as any;
  const feature = data.features?.[0];
  if (!feature) return {};

  const result: Record<string, any> = {};

  // Street name from text field
  if (feature.text) result['addr:street'] = feature.text;

  // Parse context for postcode, district, city
  for (const ctx of (feature.context ?? [])) {
    if (ctx.id?.startsWith('postal_code')) result['addr:postcode'] = ctx.text;
    if (ctx.place_designation === 'town' || ctx.place_designation === 'suburb') result['addr:district'] = ctx.text;
    if (ctx.id?.startsWith('county')) result['addr:city'] = ctx.text;
  }

  return result;
}

async function foursquareSearch(name: string, lat: number, lng: number): Promise<string | null> {
  const url = `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(name)}&ll=${lat},${lng}&limit=1&radius=500`;
  const res = await fetch(url, { headers: { Authorization: FSQ_KEY! } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`FSQ search ${res.status}: ${body}`);
  }
  const data = await res.json() as any;
  return data.results?.[0]?.fsq_id ?? null;
}

async function foursquareDetails(fsqId: string): Promise<Record<string, any>> {
  const url = `https://api.foursquare.com/v3/places/${fsqId}?fields=tel,website,hours,location`;
  const res = await fetch(url, { headers: { Authorization: FSQ_KEY! } });
  if (!res.ok) throw new Error(`FSQ details ${res.status}`);
  const d = await res.json() as any;
  const result: Record<string, any> = {};
  if (d.tel) result.phone = d.tel;
  if (d.website) result.website = d.website;
  if (d.hours?.display?.length) result.opening_hours = d.hours.display.join('; ');
  if (d.location?.address && !result['addr:street']) result['addr:street'] = d.location.address;
  return result;
}

async function main() {
  if (!MAPTILER_KEY) {
    console.error('ERROR: API_KEY not set in .env');
    process.exit(1);
  }

  const fsqEnabled = FULL && FSQ_KEY && !FSQ_KEY.startsWith('OL5'); // skip if looks invalid
  if (FULL && !fsqEnabled) {
    console.warn('WARNING: --full requested but FSQ_API_KEY missing or invalid (must start with fsq3)');
    console.warn('Falling back to address-only mode');
  }

  const raw = readFileSync(GEOJSON_PATH, 'utf-8');
  const geojson = JSON.parse(raw) as any;
  const features: GeoJsonFeature[] = geojson.features;

  const toEnrich = features.filter(f =>
    f.properties.name && (needsAddress(f.properties) || (fsqEnabled && needsFoursquare(f.properties)))
  );
  const target = Math.min(toEnrich.length, LIMIT);

  console.log(`Total venues:     ${features.length}`);
  console.log(`Need enrichment:  ${toEnrich.length}`);
  console.log(`Processing:       ${target}`);
  console.log(`Address (MapTiler): yes`);
  console.log(`Phone/Hours/Web (FSQ): ${fsqEnabled ? 'yes' : 'no (--full + valid fsq3 key needed)'}`);
  if (DRY_RUN) console.log('DRY RUN — no writes');
  console.log('');

  let addrOk = 0, addrFail = 0, fsqOk = 0, fsqFail = 0, fsqNotFound = 0;

  for (let i = 0; i < target; i++) {
    const feature = toEnrich[i];
    const { name } = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;

    process.stdout.write(`[${i + 1}/${target}] ${name.substring(0, 40).padEnd(40)} `);

    const merged: Record<string, any> = {};

    // --- MapTiler address ---
    if (needsAddress(feature.properties)) {
      try {
        const addr = await reverseGeocode(lng, lat);
        Object.assign(merged, addr);
        process.stdout.write(`addr:+${Object.keys(addr).length} `);
        addrOk++;
      } catch (e: any) {
        process.stdout.write(`addr:ERR(${e.message}) `);
        addrFail++;
      }
      await sleep(MAPTILER_DELAY);
    }

    // --- Foursquare phone/hours/website ---
    if (fsqEnabled && needsFoursquare(feature.properties)) {
      try {
        const fsqId = await foursquareSearch(name, lat, lng);
        if (!fsqId) {
          process.stdout.write('fsq:notfound');
          fsqNotFound++;
        } else {
          const detail = await foursquareDetails(fsqId);
          Object.assign(merged, detail);
          process.stdout.write(`fsq:+${Object.keys(detail).length}`);
          fsqOk++;
        }
        await sleep(FSQ_DELAY);
      } catch (e: any) {
        process.stdout.write(`fsq:ERR(${e.message})`);
        fsqFail++;
        if (e.message.includes('429')) await sleep(5000);
      }
    }

    if (!DRY_RUN && Object.keys(merged).length > 0) {
      feature.properties = { ...feature.properties, ...merged };
    }

    process.stdout.write('\n');

    // Save every 200 venues to not lose progress
    if (!DRY_RUN && (i + 1) % 200 === 0) {
      writeFileSync(GEOJSON_PATH, JSON.stringify(geojson, null, 2), 'utf-8');
      console.log(`  → checkpoint saved (${i + 1} processed)`);
    }
  }

  if (!DRY_RUN) {
    writeFileSync(GEOJSON_PATH, JSON.stringify(geojson, null, 2), 'utf-8');
    console.log(`\nSaved → ${GEOJSON_PATH}`);
  }

  console.log(`\nAddress: ${addrOk} ok, ${addrFail} failed`);
  if (fsqEnabled) console.log(`Foursquare: ${fsqOk} ok, ${fsqNotFound} not found, ${fsqFail} failed`);
}

main().catch(console.error);
