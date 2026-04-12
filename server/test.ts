import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const password = "mytestpassword123";
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Original:", password);
    console.log("Hashed:", hashedPassword);

    const email = "test" + Date.now() + "@example.com";

    // Register
    const user = await prisma.user.create({
        data: {
            email,
            username: "user_" + Date.now(),
            password: hashedPassword,
            factionId: 1
        }
    });

    console.log("User created:", user.id);

    // Login
    const foundUser = await prisma.user.findUnique({ where: { email } });
    if (!foundUser) {
        console.log("Not found by email!");
        return;
    }

    console.log("Found user:", foundUser.id, foundUser.password);

    const isMatch = await bcrypt.compare(password, foundUser.password);
    console.log("Is match?", isMatch);
}

main().catch(console.error).finally(() => prisma.$disconnect());
