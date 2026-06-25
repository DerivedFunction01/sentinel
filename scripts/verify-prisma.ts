/**
 * Verify Prisma Postgres connection
 *
 * Run: npx tsx scripts/verify-prisma.ts
 */
import { db } from "../src/lib/db";

async function main() {
  const count = await db.user.count();
  console.log(`\n✅ Connected. Users in database: ${count}\n`);
}

main()
  .catch((e) => {
    console.error("❌ Connection failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
