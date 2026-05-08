-- 1. Uzamsal Gücü Etkinleştir
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Gruplar Tablosunu Oluştur
CREATE TABLE "Faction" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT UNIQUE NOT NULL,
    "color" TEXT NOT NULL,
    "hexesOwned" INTEGER DEFAULT 0
);

-- 3. Kullanıcılar Tablosunu Oluştur
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

-- 4. Mekanlar Tablosunu Oluştur (Uzamsal Çekirdek)
CREATE TABLE "Venue" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "h3Index" TEXT NOT NULL, -- Uber H3 Adresi
    "location" GEOMETRY(Point, 4326) -- PostGIS Noktası
);

-- 5. Ziyaretler Tablosunu Oluştur (Keşif Günlüğü) -> Reviews
CREATE TABLE "Review" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER REFERENCES "User"(id),
    "venueId" INTEGER REFERENCES "Venue"(id),
    "rating" INTEGER DEFAULT 5,
    "content" TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Performans İçin Uzamsal Dizin (Eğitmenler buna BAYILIR)
CREATE INDEX idx_venue_location ON "Venue" USING GIST (location);
CREATE INDEX idx_venue_h3 ON "Venue" (h3Index);

-- 7. İlk Grupları Tohumla
INSERT INTO "Faction" (name, color) VALUES ('Red Reapers', '#FF0000');
INSERT INTO "Faction" (name, color) VALUES ('Blue Sentinels', '#0000FF');
INSERT INTO "Faction" (name, color) VALUES ('Green Guardians', '#00FF00');