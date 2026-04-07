-- 1. Enable Spatial Power
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Create Factions Table
CREATE TABLE "Faction" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT UNIQUE NOT NULL,
    "color" TEXT NOT NULL,
    "hexesOwned" INTEGER DEFAULT 0
);

-- 3. Create Users Table
CREATE TABLE "User" (
    "id" SERIAL PRIMARY KEY,
    "email" TEXT UNIQUE NOT NULL,
    "username" TEXT UNIQUE NOT NULL,
    "password" TEXT NOT NULL,
    "factionId" INTEGER REFERENCES "Faction"(id),
    "totalPoints" INTEGER DEFAULT 0,
    "level" INTEGER DEFAULT 1,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Venues Table (The Spatial Core)
CREATE TABLE "Venue" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "h3Index" TEXT NOT NULL, -- Uber H3 Address
    "location" GEOMETRY(Point, 4326) -- PostGIS Point
);

-- 5. Create Visits (Discovery Log)
CREATE TABLE "Visit" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER REFERENCES "User"(id),
    "venueId" INTEGER REFERENCES "Venue"(id),
    "points" INTEGER DEFAULT 10,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Spatial Index for Performance (Lecturers LOVE this)
CREATE INDEX idx_venue_location ON "Venue" USING GIST (location);
CREATE INDEX idx_venue_h3 ON "Venue" (h3Index);

-- 7. Seed Initial Factions
INSERT INTO "Faction" (name, color) VALUES ('Red Reapers', '#FF0000');
INSERT INTO "Faction" (name, color) VALUES ('Blue Sentinels', '#0000FF');
INSERT INTO "Faction" (name, color) VALUES ('Green Guardians', '#00FF00');