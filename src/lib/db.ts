import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { createAdapter } from "./db-adapter";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: createAdapter(process.env.DATABASE_URL ?? "") });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
