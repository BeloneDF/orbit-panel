import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient();
const email = (process.env.INITIAL_ADMIN_EMAIL || "admin@orbit.local").toLowerCase();
const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
if (!initialPassword || initialPassword.length < 12) throw new Error("INITIAL_ADMIN_PASSWORD precisa ter no mínimo 12 caracteres.");
const password = initialPassword;

async function main() {
try {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await db.user.upsert({
    where: { email },
    update: { name: "Administrador inicial", role: "ADMINISTRADOR", status: "ACTIVE", mustChangePassword: true, passwordHash, deletedAt: null },
    create: { name: "Administrador inicial", email, role: "ADMINISTRADOR", status: "ACTIVE", mustChangePassword: true, passwordHash },
  });
  console.log(`Administrador ativo: ${email}`);
} finally { await db.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
