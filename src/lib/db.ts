import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL ?? "";

  if (
    databaseUrl.startsWith("postgresql://") ||
    databaseUrl.startsWith("postgres://")
  ) {
    // Prisma Postgres / PostgreSQL
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter, log: ["query"] });
  }

  // SQLite fallback
  let dbPath = "db/custom.db";
  if (databaseUrl) {
    const match = databaseUrl.match(/^file:(.+)$/);
    if (match && match[1]) {
      const rawPath = match[1];
      if (rawPath.startsWith("../")) {
        dbPath = rawPath.substring(3);
      } else {
        dbPath = rawPath;
      }
    }
  }
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({
    adapter,
    log: ["query"],
  });
}

export const db = globalForPrisma.prisma ?? getPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
