-- Rename Visit to Review
ALTER TABLE "Visit" RENAME TO "Review";

-- Rename points to rating and update default, and type if necessary
-- points was Int, rating is Int. So just rename column.
ALTER TABLE "Review" RENAME COLUMN "points" TO "rating";

-- Add content column
ALTER TABLE "Review" ADD COLUMN "content" TEXT;

-- We also need to update the sequence if it exists, though Prisma typically names it "Visit_id_seq"
ALTER SEQUENCE IF EXISTS "Visit_id_seq" RENAME TO "Review_id_seq";
