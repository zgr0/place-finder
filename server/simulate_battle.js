require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

let dbUrl = process.env.DATABASE_URL;

// Kullanıcı bu komut dosyasını doğrudan yerel makinesinde çalıştırırsa, Docker içindeki "db" makine adını otomatik olarak "localhost" ile değiştir
if (dbUrl && dbUrl.includes('@db:5432')) {
    dbUrl = dbUrl.replace('@db:5432', '@localhost:5432');
}

if (!dbUrl) {
  console.error('Please set DATABASE_URL environment variable');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

async function simulate() {
    console.log("Starting venue finder Battle Simulation");

    // Haritanın Kırmızı, Mavi ve Yeşil üretmesi için çeşitli gruplara sahip kullanıcılar oluştur
    for (let f = 1; f <= 3; f++) {
       await prisma.user.upsert({
           where: { username: `BattleBot_F${f}` },
           update: {},
           create: {
               email: `bot${f}@placefinder.com`,
               username: `BattleBot_F${f}`,
               password: "mockpassword",
               factionId: f
           }
       });
    }

    // 1. Mevcut tüm kullanıcıları ve mekanları al
    const users = await prisma.user.findMany();
    const venues = await prisma.venue.findMany();

    if (users.length === 0 || venues.length === 0) {
        console.error("Error: You need users and venues in the DB first!");
        return;
    }

    console.log(`Simulating for ${users.length} users across ${venues.length} venues.`);

    // 2. Simülasyon Döngüsü
    // Bu, 200 "Yer bildirimi" (Check-in) gerçekleştirecek
    for (let i = 0; i < 200; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        const randomVenue = venues[Math.floor(Math.random() * venues.length)];

        await prisma.visit.create({
            data: {
                userId: randomUser.id,
                venueId: randomVenue.id,
            }
        });

        // "Savaş" (Savaş) ilerlemesini günlüğe kaydet
        console.log(`[Step ${i + 1}/200] User ${randomUser.username} (Faction ${randomUser.factionId}) checked into ${randomVenue.name}`);

        // İsteğe bağlı: Haritanızda "canlı" olarak güncellenmesini izlemek için küçük bir gecikme ekleyin
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log("Simulation Complete. Check the Map!");
}

simulate()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());