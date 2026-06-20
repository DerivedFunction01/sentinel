import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDeterministicHardenedPrompt, getHardenedPromptInstructions } from "@/lib/scan-prompts";
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
        return NextResponse.json({
          originalPrompt: scanRow.systemPrompt,
          hardenedPrompt: existing.prompt,
          modelId: existing.modelId,
          modelName: existing.modelName,
        });
      }
    }

    // Fallback to the first available hardened prompt, or create a deterministic one
    const firstPrompt = scanRow.hardenedPrompts[0]?.prompt || 
      getDeterministicHardenedPrompt(scanRow.systemPrompt, scanRow.forbiddenTask);

    return NextResponse.json({
      originalPrompt: scanRow.systemPrompt,
      hardenedPrompt: firstPrompt,
      modelId: scanRow.hardenedPrompts[0]?.modelId || "fallback",
      modelName: scanRow.hardenedPrompts[0]?.modelName || "Fallback",
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

    // Check if this model's hardened prompt already exists
    const existing = await db.hardenedPrompt.findUnique({
      where: {
        scanId_modelId: {
          scanId: scanRow.id,
          modelId,
        }
      }
    });

    if (existing) {
      return NextResponse.json({
        originalPrompt: scanRow.systemPrompt,
        hardenedPrompt: existing.prompt,
        modelId: existing.modelId,
        modelName: existing.modelName,
      });
    }

    // Otherwise, generate it!
    const dbModel = await db.model.findUnique({ where: { id: modelId } });
    const modelName = dbModel?.name || modelId.split("/").pop() || modelId;

    const trials = JSON.parse(scanRow.trials);
    const breachedAttacks = trials
      .filter((t: any) => t.verdict === TrialVerdict.Breached)
      .map((t: any) => t.attack);

    const systemInstructions = getHardenedPromptInstructions(
      scanRow.systemPrompt,
      scanRow.forbiddenTask,
      breachedAttacks
    );

    let hardenedPromptText = "";
    try {
      const response = await callOpenRouter(modelId, [
        { role: "user", content: systemInstructions }
      ]);
      hardenedPromptText = response.content || "";
      hardenedPromptText = hardenedPromptText
        .replace(/^```[a-zA-Z]*\n/g, "")
        .replace(/\n```$/g, "")
        .trim();
    } catch (err) {
      console.error("Error generating hardened prompt via API:", err);
      hardenedPromptText = getDeterministicHardenedPrompt(scanRow.systemPrompt, scanRow.forbiddenTask);
    }

    // Save to the database
    const saved = await db.hardenedPrompt.create({
      data: {
        scanId: scanRow.id,
        modelId,
        modelName,
        prompt: hardenedPromptText,
      }
    });

    return NextResponse.json({
      originalPrompt: scanRow.systemPrompt,
      hardenedPrompt: saved.prompt,
      modelId: saved.modelId,
      modelName: saved.modelName,
    });
  } catch (error: any) {
    console.error("Error generating hardened prompt:", error);
    return new Response("Error generating hardened prompt", { status: 500 });
  }
}
