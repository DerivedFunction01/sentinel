import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getDeterministicHardenedPrompt,
  getHardenedPromptInstructions,
} from "@/lib/scan-prompts";
import { generateToolRecommendation } from "@/lib/tool-extractor";
import { callOpenRouter } from "@/app/api/scan/launch/route";
import { db } from "@/lib/db";
import { TrialVerdict } from "@/lib/enums";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const scanRow = await db.scan.findFirst({
      where: { reportId, userId: session.user.id },
      include: { hardenedPrompts: true }
    });
    if (!scanRow) {
      return new Response("Scan not found", { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get("modelId");

    if (modelId) {
      const existing = await db.hardenedPrompt.findUnique({
        where: {
          scanId_modelId: {
            scanId: scanRow.id,
            modelId,
          }
        }
      });
      if (existing) {
        let recObj: any = null;
        if (existing.toolRecommendation) {
          try {
            recObj = JSON.parse(existing.toolRecommendation);
          } catch {}
        }
        return NextResponse.json({
          originalPrompt: scanRow.systemPrompt,
          hardenedPrompt: existing.prompt,
          modelId: existing.modelId,
          modelName: existing.modelName,
          toolRecommendation: recObj,
          compatibilityScore: existing.compatibilityScore,
          granularity: existing.granularity,
          extractorModel: existing.extractorModel,
        });
      }
    }

    // Fallback to the first available hardened prompt, or create a deterministic one
    const firstPrompt = scanRow.hardenedPrompts[0];
    const hardenedPromptText = firstPrompt?.prompt || 
      getDeterministicHardenedPrompt(scanRow.systemPrompt, scanRow.forbiddenTask);

    let recObj: any = null;
    if (firstPrompt?.toolRecommendation) {
      try {
        recObj = JSON.parse(firstPrompt.toolRecommendation);
      } catch {}
    }

    return NextResponse.json({
      originalPrompt: scanRow.systemPrompt,
      hardenedPrompt: hardenedPromptText,
      modelId: firstPrompt?.modelId || "fallback",
      modelName: firstPrompt?.modelName || "Fallback",
      toolRecommendation: recObj,
      compatibilityScore: firstPrompt?.compatibilityScore,
      granularity: firstPrompt?.granularity,
      extractorModel: firstPrompt?.extractorModel,
    });
  } catch (error: any) {
    console.error("Error retrieving hardened prompt:", error);
    return new Response("Error retrieving hardened prompt", { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const scanRow = await db.scan.findFirst({
      where: { reportId, userId: session.user.id },
      include: { hardenedPrompts: true }
    });
    if (!scanRow) {
      return new Response("Scan not found", { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const modelId = body.modelId || scanRow.judgeModel || scanRow.attackerModel || "google/gemini-2.5-flash";
    const granularity = body.granularity || "compact";
    const extractorModel = body.extractorModel || "google/gemini-2.5-flash";

    // Check if this model's hardened prompt already exists
    const existing = await db.hardenedPrompt.findUnique({
      where: {
        scanId_modelId: {
          scanId: scanRow.id,
          modelId,
        }
      }
    });

    let promptTextToExtract = "";
    let modelName = "";

    if (existing) {
      promptTextToExtract = existing.prompt;
      modelName = existing.modelName;
    } else {
      const dbModel = await db.model.findUnique({ where: { id: modelId } });
      modelName = dbModel?.name || modelId.split("/").pop() || modelId;

      const trials = JSON.parse(scanRow.trials);
      const breachedAttacks = trials
        .filter((t: any) => t.verdict === TrialVerdict.Breached)
        .map((t: any) => t.attack);

      const systemInstructions = getHardenedPromptInstructions(
        scanRow.systemPrompt,
        scanRow.forbiddenTask,
        breachedAttacks
      );

      try {
        const response = await callOpenRouter(modelId, [
          { role: "user", content: systemInstructions }
        ]);
        promptTextToExtract = response.content || "";
        promptTextToExtract = promptTextToExtract
          .replace(/^```[a-zA-Z]*\n/g, "")
          .replace(/\n```$/g, "")
          .trim();
      } catch (err) {
        console.error("Error generating hardened prompt via API:", err);
        promptTextToExtract = getDeterministicHardenedPrompt(scanRow.systemPrompt, scanRow.forbiddenTask);
      }
    }

    // Run tool extraction
    const { toolRecommendation, compatibilityScore } = await generateToolRecommendation(
      promptTextToExtract,
      scanRow.forbiddenTask,
      granularity,
      extractorModel
    );

    let saved;
    if (existing) {
      saved = await db.hardenedPrompt.update({
        where: { id: existing.id },
        data: {
          toolRecommendation,
          compatibilityScore,
          granularity,
          extractorModel,
        }
      });
    } else {
      saved = await db.hardenedPrompt.create({
        data: {
          scanId: scanRow.id,
          modelId,
          modelName,
          prompt: promptTextToExtract,
          toolRecommendation,
          compatibilityScore,
          granularity,
          extractorModel,
        }
      });
    }

    let recObj: any = null;
    if (saved.toolRecommendation) {
      try {
        recObj = JSON.parse(saved.toolRecommendation);
      } catch {}
    }

    return NextResponse.json({
      originalPrompt: scanRow.systemPrompt,
      hardenedPrompt: saved.prompt,
      modelId: saved.modelId,
      modelName: saved.modelName,
      toolRecommendation: recObj,
      compatibilityScore: saved.compatibilityScore,
      granularity: saved.granularity,
      extractorModel: saved.extractorModel,
    });
  } catch (error: any) {
    console.error("Error generating/updating hardened prompt:", error);
    return new Response("Error generating/updating hardened prompt", { status: 500 });
  }
}
