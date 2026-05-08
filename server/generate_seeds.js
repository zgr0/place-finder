const axios = require('axios');
const h3 = require('h3-js');
const fs = require('fs');

// Coordinates for Kadıköy/Moda (minLat, minLng, maxLat, maxLng)
const BBOX = "40.9776,29.0134,41.0000,29.0433";
const H3_RESOLUTION = 9; // High resolution for precise neighborhood capturing

const query = `
[out:json][timeout:25];
(
  node["amenity"="cafe"](${BBOX});
  node["amenity"="restaurant"](${BBOX});
);
out body;
`;

const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

async function generateSQL() {
  try {
    console.log("Fetching real-world data from OpenStreetMap");
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'PlaceFinderSeedScript/1.0 (contact@placefinder.com)' }
    });
    const elements = response.data.elements;

    let sqlStatements = `-- ECHELON Venue Seed Data\n`;
    sqlStatements += `DELETE FROM "Review"; -- Clear reviews due to FK\n`;
    sqlStatements += `DELETE FROM "Venue"; -- Clear old data\n\n`;

    elements.forEach((el) => {
      if (el.tags && el.tags.name) {
        const name = el.tags.name.replace(/'/g, "''"); // Escape single quotes for SQL
        const category = el.tags.amenity || 'Venue';
        const lat = el.lat;
        const lng = el.lon;

        // Calculate the H3 Hexagon ID
        const h3Index = h3.latLngToCell(lat, lng, H3_RESOLUTION);

        // Generate the SQL Insert
        // ST_SetSRID(ST_MakePoint(lng, lat), 4326) is the PostGIS standard
        sqlStatements += `INSERT INTO "Venue" (name, category, "h3Index", location) VALUES ('${name}', '${category}', '${h3Index}', ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326));\n`;
      }
    });

    fs.writeFileSync('seed_venues.sql', sqlStatements);
    console.log(`Success! Generated seed_venues.sql with ${elements.length} real locations.`);
    console.log(`Area: Kadıköy/Moda`);
  } catch (error) {
    console.error("Error fetching data:", error.message);
  }
}

generateSQL();