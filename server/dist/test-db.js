"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
async function main() {
    try {
        const adapter = new adapter_pg_1.PrismaPg({ connectionString: process.env.DATABASE_URL });
        const prisma = new client_1.PrismaClient({ adapter });
        const factions = await prisma.faction.findMany();
        console.log("Factions:", factions);
    }
    catch (e) {
        console.error("Failed to connect or query:", e);
    }
}
main();
//# sourceMappingURL=test-db.js.map