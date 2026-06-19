"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    const password = "mytestpassword123";
    const hashedPassword = await bcrypt_1.default.hash(password, 10);
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
    const isMatch = await bcrypt_1.default.compare(password, foundUser.password);
    console.log("Is match?", isMatch);
}
main().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=test.js.map