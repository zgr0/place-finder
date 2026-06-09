const axios = require('axios');
const h3 = require('h3-js');
const fs = require('fs');
const path = require('path');

const H3_RESOLUTION = 8;

const query = `
  [out:json][timeout:300];
  area["name"="İstanbul"]->.searchArea;
  (
    node["amenity"~"cafe|restaurant|bar|bookstore"](area.searchArea);
    node["shop"~"books|boutique"](area.searchArea);
    node["tourism"~"museum|viewpoint"](area.searchArea);
  );
  out body;
`;

async function generateSeeds() {
  console.log('Fetching Istanbul venue data from OpenStreetMap...');

  let elements;
  try {
    const response = await axios.post(
      'https://overpass.kumi.systems/api/interpreter',
      `data=${encodeURIComponent(query)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'PlaceFinderSeedScript/2.0',
        },
        timeout: 360000,
      }
    );
    elements = response.data.elements;
    console.log(`Fetched ${elements.length} elements.`);
  } catch (error) {
    console.error('Fetch failed:', error.message);
    process.exit(1);
  }

  const named = elements.filter(el => el.tags && el.tags.name && el.lat && el.lon);
  console.log(`${named.length} elements with name + coordinates.`);

  // --- GeoJSON ---
  const features = named.map(el => ({
    type: 'Feature',
    id: String(el.id),
    properties: {
      ...el.tags,
      name: el.tags.name,
      amenity: el.tags.amenity || el.tags.shop || el.tags.tourism || 'venue',
    },
    geometry: {
      type: 'Point',
      coordinates: [el.lon, el.lat],
    },
  }));

  const geojson = {
    type: 'FeatureCollection',
    generator: 'overpass-api',
    timestamp: new Date().toISOString(),
    features,
  };

  const geojsonPath = path.join(__dirname, 'src', 'cafe.geojson');
  fs.writeFileSync(geojsonPath, JSON.stringify(geojson, null, 2), 'utf-8');
  console.log(`Wrote ${features.length} features → src/cafe.geojson`);

  // --- SQL ---
  let sql = `-- Istanbul Venue Seed Data (${new Date().toISOString()})\n`;
  sql += `DELETE FROM "Review";\n`;
  sql += `DELETE FROM "Venue";\n\n`;

  for (const el of named) {
    const name = el.tags.name.replace(/'/g, "''");
    const category = el.tags.amenity || el.tags.shop || el.tags.tourism || 'venue';
    const address = (el.tags['addr:full'] || el.tags['addr:street'] || '').replace(/'/g, "''");
    const lat = el.lat;
    const lng = el.lon;
    const h3Index = h3.latLngToCell(lat, lng, H3_RESOLUTION);

    sql += `INSERT INTO "Venue" (name, category, address, "h3Index", location) VALUES ('${name}', '${category}', ${address ? `'${address}'` : 'NULL'}, '${h3Index}', ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326));\n`;
  }

  const sqlPath = path.join(__dirname, 'seed_venues.sql');
  fs.writeFileSync(sqlPath, sql, 'utf-8');
  console.log(`Wrote SQL → seed_venues.sql`);
  console.log('Done.');
}

generateSeeds();
