-- Make factionId nullable in User
ALTER TABLE "User" ALTER COLUMN "factionId" DROP NOT NULL;

-- Add new columns to Faction
ALTER TABLE "Faction" ADD COLUMN "description" TEXT;
ALTER TABLE "Faction" ADD COLUMN "createdBy" INTEGER;
ALTER TABLE "Faction" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- FK: Faction.createdBy -> User.id (SET NULL on delete)
ALTER TABLE "Faction" ADD CONSTRAINT "Faction_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
