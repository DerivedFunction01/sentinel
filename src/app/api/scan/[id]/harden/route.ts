import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getDeterministicHardenedPrompt,
  executeMultiStepHardening,
} from "@/lib/scan-prompts";
import {
  generateToolRecommendation,
  parseSectionedRecommendation,
} from "@/lib/tool-extractor";
import {
  retrieveInspirationExamples,
  formatInspirationExamplesBlock,
} from "@/lib/inspiration-retriever";
import { callOpenRouter } from "@/lib/scan-pipeline";
import { db } from "@/lib/db";
import { TrialVerdict } from "@/lib/enums";
import {
  type ToolDef,
  type HardeningTrace,
  type BusinessCategory,
  Granularity,
} from "@/lib/types";
import { Grab } from "lucide-react";
import { DEFAULT_MODEL } from "@/lib/model-utils";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: reportId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const scanRow = await db.scan.findFirst({
      where: { reportId, userId: session.user.id },
      include: { hardenedPrompts: true },
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
          },
        },
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
    const hardenedPromptText =
      firstPrompt?.prompt ||
      getDeterministicHardenedPrompt(
        scanRow.systemPrompt,
        scanRow.forbiddenTask,
      );

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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: reportId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const scanRow = await db.scan.findFirst({
      where: { reportId, userId: session.user.id },
      include: { hardenedPrompts: true },
    });
    if (!scanRow) {
      return new Response("Scan not found", { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const modelId =
      body.modelId ||
      scanRow.judgeModel ||
      scanRow.attackerModel ||
      DEFAULT_MODEL;
    const granularity = body.granularity || Granularity.Compact;
    const extractorModel = body.extractorModel || DEFAULT_MODEL;

    // Check if this model's hardened prompt record already exists
    const existing = await db.hardenedPrompt.findUnique({
      where: {
        scanId_modelId: {
          scanId: scanRow.id,
          modelId,
        },
      },
    });

    const dbModel = await db.model.findUnique({ where: { id: modelId } });
    const modelName = dbModel?.name || modelId.split("/").pop() || modelId;

    const trace: HardeningTrace = {};

    const trials = scanRow.trials ? JSON.parse(scanRow.trials) : [];
    const breachedAttacks = trials
      .filter((t: any) => t.verdict === TrialVerdict.Breached)
      .map((t: any) => ({
        attack: t.attack,
        judgeReasoning: t.judgeVerdict,
        verdict: t.verdict,
      }));
    const mockToolResponses = scanRow.mockToolResponses
      ? JSON.parse(scanRow.mockToolResponses)
      : {};

    // Run tool extraction first on the original system prompt
    const existingTools = scanRow.tools
      ? (JSON.parse(scanRow.tools) as ToolDef[])
      : [];

    const metadata = scanRow.metadata ? JSON.parse(scanRow.metadata) : null;

    const { toolRecommendation, compatibilityScore } =
      await generateToolRecommendation(
        scanRow.systemPrompt,
        scanRow.forbiddenTask,
        granularity,
        extractorModel,
        undefined,
        undefined,
        existingTools,
        trace,
        trials,
        mockToolResponses,
        metadata?.seedExtraction?.businessCategories || [],
        metadata?.seedExtraction?.personaDescription,
        metadata?.seedExtraction?.businessFeatures,
        metadata?.seedExtraction?.businessScenarios,
      );

    // Parse recommended tools to pass to prompt hardener
    const recommendedToolsList = toolRecommendation
      ? parseSectionedRecommendation(toolRecommendation)
      : [];

    // Step 0: Get inspiration examples from the database
    const inspirationExamples = await retrieveInspirationExamples(
      scanRow.forbiddenTask,
      extractorModel,
      granularity,
      undefined,
      trace,
      metadata,
    );
    const inspirationExamplesBlock =
      formatInspirationExamplesBlock(inspirationExamples);

    let promptTextToExtract = "";
    try {
      promptTextToExtract = await executeMultiStepHardening(
        async (promptText) => {
          const response = await callOpenRouter(modelId, [
            { role: "user", content: promptText },
          ]);
          return response.content || "";
        },
        scanRow.systemPrompt,
        scanRow.forbiddenTask,
        breachedAttacks,
        recommendedToolsList,
        inspirationExamplesBlock,
        trace,
        metadata?.attackSummary?.summarizedPatterns,
      );
    } catch (err) {
      console.error("Error generating hardened prompt via API:", err);
      promptTextToExtract = getDeterministicHardenedPrompt(
        scanRow.systemPrompt,
        scanRow.forbiddenTask,
      );
    }

    let saved;
    if (existing) {
      saved = await db.hardenedPrompt.update({
        where: { id: existing.id },
        data: {
          prompt: promptTextToExtract,
          toolRecommendation,
          compatibilityScore,
          granularity,
          extractorModel,
        },
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
        },
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
      trace,
    });
  } catch (error: any) {
    console.error("Error generating/updating hardened prompt:", error);
    return new Response("Error generating/updating hardened prompt", {
      status: 500,
    });
  }
}
