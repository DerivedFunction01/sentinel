import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const schemaPath = path.join(__dirname, "../prisma/schema.prisma");
const envPath = path.join(__dirname, "../.env");

function main() {
  const target = process.argv[2];
  if (target !== "postgres" && target !== "sqlite") {
    console.error("Usage: bun run scripts/switch-db.ts <postgres|sqlite>");
    process.exit(1);
  }

  console.log(`Switching database provider to: ${target}...`);

  // 1. Update prisma/schema.prisma provider
  let schemaContent = fs.readFileSync(schemaPath, "utf-8");
  const providerRegex =
    /provider\s*=\s*"[^"]+"\s*\/\/\s*datasource\s*db|provider\s*=\s*"[^"]+"/g;

  // We locate the datasource db block
  const datasourceBlockStart = schemaContent.indexOf("datasource db {");
  if (datasourceBlockStart === -1) {
    console.error("Could not find datasource db block in schema.prisma");
    process.exit(1);
  }
  const datasourceBlockEnd = schemaContent.indexOf("}", datasourceBlockStart);
  let datasourceBlock = schemaContent.substring(
    datasourceBlockStart,
    datasourceBlockEnd + 1,
  );

  const targetProvider = target === "postgres" ? "postgresql" : "sqlite";
  datasourceBlock = datasourceBlock.replace(
    /provider\s*=\s*"[^"]+"/,
    `provider = "${targetProvider}"`,
  );

  schemaContent =
    schemaContent.substring(0, datasourceBlockStart) +
    datasourceBlock +
    schemaContent.substring(datasourceBlockEnd + 1);
  fs.writeFileSync(schemaPath, schemaContent, "utf-8");
  console.log(`✓ Updated provider in schema.prisma to "${targetProvider}"`);

  // 2. Update .env file
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf-8");
  }

  // Find any existing DATABASE_URL (commented or not)
  const lines = envContent.split("\n");
  let pgUrl = ""; // default fallback
  let sqliteUrl = "file:./db/custom.db";

  // Try to extract existing postgres URL from env file
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith("DATABASE_URL=") &&
      (trimmed.includes("postgres://") || trimmed.includes("postgresql://"))
    ) {
      pgUrl = trimmed.split("DATABASE_URL=")[1];
    } else if (
      trimmed.startsWith("# DATABASE_URL=") &&
      (trimmed.includes("postgres://") || trimmed.includes("postgresql://"))
    ) {
      pgUrl = trimmed.split("# DATABASE_URL=")[1];
    }
  }

  // Generate new env content by removing old DATABASE_URL lines and putting the new commented/uncommented blocks at the top
  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();
    return (
      !trimmed.startsWith("DATABASE_URL=") &&
      !trimmed.startsWith("# DATABASE_URL=")
    );
  });

  const dbConfigBlock =
    target === "postgres"
      ? `DATABASE_URL=${pgUrl}\n# DATABASE_URL=${sqliteUrl}`
      : `# DATABASE_URL=${pgUrl}\nDATABASE_URL=${sqliteUrl}`;

  const newEnvContent =
    dbConfigBlock + "\n" + filteredLines.join("\n").trim() + "\n";
  fs.writeFileSync(envPath, newEnvContent, "utf-8");
  console.log(`✓ Updated DATABASE_URL in .env to use ${target}`);

  // 3. Run prisma generate
  console.log("Running prisma generate...");
  try {
    execSync("bun x prisma generate", { stdio: "inherit" });
    console.log("✓ Prisma Client regenerated successfully!");
  } catch (error) {
    console.error("Failed to run prisma generate:", error);
    process.exit(1);
  }
}

main();
