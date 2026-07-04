import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { gunzipSync } from "zlib";
import { RiskLevel, ScanStatus } from "@/lib/enums";

/**
 * POST /api/scans/import
 *
 * Accepts a gzipped JSONL file (the format produced by /api/scans/export).
 * Parses each line as a scan record and creates it in the DB, scoped to the
 * current user. Skips scans whose reportId already exists.
 *
 * Returns the count of imported and skipped scans.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file uploaded. Expected a .jsonl.gz file." },
      { status: 400 },
    );
  }

  // Read the file, decompress, and parse JSONL.
  const buffer = Buffer.from(await file.arrayBuffer());
  let jsonl: string;
  try {
    jsonl = gunzipSync(buffer).toString("utf-8");
  } catch {
    // Maybe it's not gzipped — try reading as plain JSONL.
    try {
      jsonl = buffer.toString("utf-8");
    } catch {
      return NextResponse.json(
        { error: "Could not decompress the file. Expected a .jsonl.gz file." },
        { status: 400 },
      );
    }
  }

  const lines = jsonl.trim().split("\n").filter(Boolean);
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    try {
      const data = JSON.parse(lines[i]);

      // Validate required fields.
      if (!data.reportId || !data.systemPrompt || !data.targetModel) {
        errors.push(`Line ${i + 1}: missing required fields`);
        continue;
      }

      // Check for existing scan with the same reportId.
      const existing = await db.scan.findUnique({
        where: { reportId: data.reportId },
      });
      if (existing) {
        skipped++;
        continue;
      }

      // Stringify JSON fields for storage.
      const metadata = data.metadata
        ? JSON.stringify(data.metadata)
        : null;
      const tools = JSON.stringify(data.tools ?? []);
      const mockToolResponses = JSON.stringify(data.mockToolResponses ?? {});
      const trials = JSON.stringify(data.trials ?? []);

      const tags = Array.isArray(data.tags)
        ? data.tags.filter((t: any) => typeof t === "string")
        : [];

      await db.scan.create({
        data: {
          reportId: data.reportId,
          userId: session.user.id,
          targetModel: data.targetModel,
          seedExtractorModel: data.seedExtractorModel ?? "",
          attackerModel: data.attackerModel ?? "",
          judgeModel: data.judgeModel ?? "",
          hardenerModel: data.hardenerModel ?? "",
          systemPrompt: data.systemPrompt,
          forbiddenTask: data.forbiddenTask ?? "",
          judgeInstructions: data.judgeInstructions ?? "",
          tools,
          mockToolResponses,
          trials,
          metadata,
          allowNoToolsFallback: data.allowNoToolsFallback ?? false,
          apiCost: data.apiCost ?? 0,
          score: data.score ?? 0,
          riskLevel: data.riskLevel ?? RiskLevel.Low,
          totalTrials: data.totalTrials ?? 0,
          breaches: data.breaches ?? 0,
          breachRate: data.breachRate ?? 0,
          summary: data.summary ?? "",
          summaryDetail: data.summaryDetail ?? "",
          tags: JSON.stringify(tags),
          hardenedPrompts: {
            create:
              data.hardenedPrompts && data.hardenedPrompts.length > 0
                ? data.hardenedPrompts.map((hp: any) => ({
                    id: hp.id,
                    modelId: hp.modelId,
                    modelName: hp.modelName,
                    prompt: hp.prompt,
                    toolRecommendation: hp.toolRecommendation
                      ? JSON.stringify(hp.toolRecommendation)
                      : null,
                    compatibilityScore: hp.compatibilityScore,
                    granularity: hp.granularity,
                    extractorModel: hp.extractorModel,
                    createdAt: hp.createdAt ? new Date(hp.createdAt) : new Date(),
                  }))
                : [
                    {
                      modelId: data.targetModel,
                      modelName: data.targetModel.split("/").pop() || data.targetModel,
                      prompt: `REVISED SYSTEM PROMPT\n${data.systemPrompt}\n\nIf a question is unrelated to "${data.forbiddenTask ?? ""}", explicitly refuse to provide any internal processes or hypothetical workflows, inform the user that you are unable to assist with that specific request, and suggest a polite and firm refusal.`,
                    },
                  ],
          },
          status: data.status ?? ScanStatus.Completed,
        },
      });
      imported++;
    } catch {
      errors.push(`Line ${i + 1}: invalid JSON`);
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    errors: errors.slice(0, 10), // cap error list
  });
}
