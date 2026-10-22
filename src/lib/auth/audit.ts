import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export async function audit(action: string, userId: string | null, metadata?: Prisma.InputJsonValue, ip?: string) {
  await db.auditLog.create({ data: { action, userId, metadata, ip } });
}
