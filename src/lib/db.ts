import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
const store = globalThis as unknown as { prisma?: PrismaClient };
export const db = store.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") store.prisma = db;
