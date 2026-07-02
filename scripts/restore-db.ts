import { db } from "../src/lib/db";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const dumpPath = path.join(__dirname, "../prisma/db-dump.json");
  if (!fs.existsSync(dumpPath)) {
    console.log("No database dump found at prisma/db-dump.json.");
    console.log("You can seed a fresh dataset by running: bun run db:seed");
    return;
  }

  console.log("Starting database restore from dump...");
  const rawData = fs.readFileSync(dumpPath, "utf-8");
  const data = JSON.parse(rawData);

  try {
    // Clean existing database records first
    console.log("Cleaning target database tables...");
    await db.emailLog.deleteMany({});
    await db.apiKey.deleteMany({});
    await db.deployment.deleteMany({});
    await db.toolSchemaExample.deleteMany({});
    await db.hardenedPrompt.deleteMany({});
    await db.scan.deleteMany({});
    await db.tokenRequest.deleteMany({});
    await db.user.deleteMany({});
    await db.model.deleteMany({});

    // 1. Users
    console.log(`Restoring ${data.users?.length || 0} Users...`);
    for (const record of data.users || []) {
      await db.user.create({ data: record });
    }

    // 2. Models
    console.log(`Restoring ${data.models?.length || 0} Models...`);
    for (const record of data.models || []) {
      await db.model.create({ data: record });
    }

    // 3. TokenRequests
    console.log(`Restoring ${data.tokenRequests?.length || 0} TokenRequests...`);
    for (const record of data.tokenRequests || []) {
      await db.tokenRequest.create({ data: record });
    }

    // 4. Scans
    console.log(`Restoring ${data.scans?.length || 0} Scans...`);
    for (const record of data.scans || []) {
      await db.scan.create({ data: record });
    }

    // 5. HardenedPrompts
    console.log(`Restoring ${data.hardenedPrompts?.length || 0} HardenedPrompts...`);
    for (const record of data.hardenedPrompts || []) {
      await db.hardenedPrompt.create({ data: record });
    }

    // 6. ToolSchemaExamples
    console.log(`Restoring ${data.toolSchemaExamples?.length || 0} ToolSchemaExamples...`);
    for (const record of data.toolSchemaExamples || []) {
      await db.toolSchemaExample.create({ data: record });
    }

    // 7. Deployments
    console.log(`Restoring ${data.deployments?.length || 0} Deployments...`);
    for (const record of data.deployments || []) {
      await db.deployment.create({ data: record });
    }

    // 8. ApiKeys
    console.log(`Restoring ${data.apiKeys?.length || 0} ApiKeys...`);
    for (const record of data.apiKeys || []) {
      await db.apiKey.create({ data: record });
    }

    // 9. EmailLogs
    console.log(`Restoring ${data.emailLogs?.length || 0} EmailLogs...`);
    for (const record of data.emailLogs || []) {
      await db.emailLog.create({ data: record });
    }

    console.log("✓ Database successfully restored!");
  } catch (error) {
    console.error("Error during database restore:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
