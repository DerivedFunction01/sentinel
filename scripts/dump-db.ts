import { db } from "../src/lib/db";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Starting database dump...");

  try {
    const users = await db.user.findMany();
    const tokenRequests = await db.tokenRequest.findMany();
    const scans = await db.scan.findMany();
    const hardenedPrompts = await db.hardenedPrompt.findMany();
    const toolSchemaExamples = await db.toolSchemaExample.findMany();
    const models = await db.model.findMany();
    const deployments = await db.deployment.findMany();
    const apiKeys = await db.apiKey.findMany();
    const emailLogs = await db.emailLog.findMany();

    const dumpData = {
      users,
      tokenRequests,
      scans,
      hardenedPrompts,
      toolSchemaExamples,
      models,
      deployments,
      apiKeys,
      emailLogs,
    };

    const dumpPath = path.join(__dirname, "../prisma/db-dump.json");
    fs.writeFileSync(dumpPath, JSON.stringify(dumpData, null, 2), "utf-8");

    console.log(`Database successfully dumped to ${dumpPath}`);
    console.log(`Summary of dumped records:`);
    console.log(`- Users: ${users.length}`);
    console.log(`- Token Requests: ${tokenRequests.length}`);
    console.log(`- Scans: ${scans.length}`);
    console.log(`- Hardened Prompts: ${hardenedPrompts.length}`);
    console.log(`- Tool Schema Examples: ${toolSchemaExamples.length}`);
    console.log(`- Models: ${models.length}`);
    console.log(`- Deployments: ${deployments.length}`);
    console.log(`- API Keys: ${apiKeys.length}`);
    console.log(`- Email Logs: ${emailLogs.length}`);
  } catch (error) {
    console.error("Error during database dump:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
