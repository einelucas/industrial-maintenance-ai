import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
const user = await prisma.user.findUnique({ where: { email: "tecnico@pcm.local" } });
console.log("active:", user.active);
console.log("matches tecnico123:", await bcrypt.compare("tecnico123", user.passwordHash));
console.log("matches novaSenha456:", await bcrypt.compare("novaSenha456", user.passwordHash));
await prisma.$disconnect();
