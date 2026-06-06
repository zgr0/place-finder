require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { parseCafeGeoJson } = require('./dist/parser');

const url = process.env.DATABASE_URL.replace('@db:5432', '@localhost:5432');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const dbVenues = await prisma.venue.findMany({ select: { name: true }, take: 10 });
  console.log('DB names (first 10):');
  dbVenues.forEach(v => console.log(' ', JSON.stringify(v.name)));

  try {
    const geo = parseCafeGeoJson();
    const geoNames = (geo.features || []).map(f => f.properties?.name).filter(Boolean).slice(0, 10);
    console.log('\nGeoJSON names (first 10):');
    geoNames.forEach(n => console.log(' ', JSON.stringify(n)));

    // Check overlap
    const dbSet = new Set((await prisma.venue.findMany({ select: { name: true } })).map(v => v.name));
    const geoAll = (geo.features || []).map(f => f.properties?.name).filter(Boolean);
    const matched = geoAll.filter(n => dbSet.has(n));
    console.log(`\nOverlap: ${matched.length} / ${geoAll.length} GeoJSON names exist in DB`);
  } catch (e) {
    console.log('Parser not built yet — check raw GeoJSON instead');
    const fs = require('fs');
    const path = require('path');
    const geoPath = path.join(__dirname, 'src', 'cafe.geojson');
    if (fs.existsSync(geoPath)) {
      const geo = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
      const geoNames = (geo.features || []).map(f => f.properties?.name).filter(Boolean).slice(0, 10);
      console.log('\nGeoJSON names (first 10):');
      geoNames.forEach(n => console.log(' ', JSON.stringify(n)));
      const dbSet = new Set((await prisma.venue.findMany({ select: { name: true } })).map(v => v.name));
      const geoAll = (geo.features || []).map(f => f.properties?.name).filter(Boolean);
      const matched = geoAll.filter(n => dbSet.has(n));
      console.log(`\nOverlap: ${matched.length} / ${geoAll.length} GeoJSON names exist in DB`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
