import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const schemaPath = path.join(__dirname, "../prisma/schema.prisma");
const envPath = path.join(__dirname, "../.env");

function main() {
  // 1. Determine target (CLI argument takes priority, fallback to ENV variable for Vercel)
  let target = process.argv[2] || process.env.DB_PROVIDER;

  if (target !== "postgres" && target !== "sqlite") {
    console.error(
      "Usage: bun run scripts/switch-db.ts <postgres|sqlite> OR set DB_PROVIDER env var",
    );
    process.exit(1);
  }

  console.log(`Switching database provider to: ${target}...`);

  // 2. Update prisma/schema.prisma provider
  let schemaContent = fs.readFileSync(schemaPath, "utf-8");
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

  // 3. Only update local .env if we are NOT running on Vercel
  if (!process.env.VERCEL) {
    let envContent = fs.existsSync(envPath)
      ? fs.readFileSync(envPath, "utf-8")
      : "";
    const lines = envContent.split("\n");
    let pgUrl = "";
    let sqliteUrl = "file:./db/custom.db";

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
    console.log(`✓ Updated DATABASE_URL in local .env`);
  } else {
    console.log(` Skipping .env update because we are deploying on Vercel.`);
  }
  // 3.5 Log the database URL/source being utilized for debugging
  const currentUrl = process.env.DATABASE_URL;
  if (currentUrl) {
    try {
      // Clean up the URL to log safely without passwords
      if (currentUrl.startsWith("file:")) {
        console.log(`📡 Current DATABASE_URL in use: ${currentUrl}`);
      } else {
        // Parse postgres URL safely to hide credentials
        const parsedUrl = new URL(currentUrl);
        console.log(
          `📡 Current DATABASE_URL Target: ${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`,
        );
      }
    } catch (e) {
      // Fallback if it's a non-standard string format
      console.log(
        `📡 Current DATABASE_URL is set (Length: ${currentUrl.length} chars)`,
      );
    }
  } else {
    console.warn(
      "⚠️ Warning: process.env.DATABASE_URL is currently undefined!",
    );
  }

  // 4. Run prisma generate
  console.log("Running prisma generate...");

  // 4. Run prisma generate
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
