import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
    try {
        const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
        const prisma = new PrismaClient({ adapter });

        const factions = await prisma.faction.findMany();
        console.log("Factions:", factions);
    } catch (e) {
        console.error("Failed to connect or query:", e);
    }
}
main();
