import { PrismaClient } from '../../prisma/generated/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getPrismaClient() {
  let dbPath = 'db/custom.db';
  if (process.env.DATABASE_URL) {
    const url = process.env.DATABASE_URL;
    const match = url.match(/^file:(.+)$/);
    if (match && match[1]) {
      const rawPath = match[1];
      if (rawPath.startsWith('../')) {
        dbPath = rawPath.substring(3);
      } else {
        dbPath = rawPath;
      }
    }
  }
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({
    adapter,
    log: ['query'],
  });
}

export const db = globalForPrisma.prisma ?? getPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;