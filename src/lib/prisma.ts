// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Conexión con pooler (puerto 6543 en Supabase), para el runtime de la app.
// La CLI (migrate, studio...) usa DIRECT_URL en prisma.config.ts — son
// intencionadamente distintas, no un descuido.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}