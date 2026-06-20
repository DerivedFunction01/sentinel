import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-utils";

/**
 * GET /api/deployments
 * Returns all active deployment profiles for the logged-in user.
 */
export async function GET(req: Request) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deployments = await db.deployment.findMany({
      where: { userId: authUser.userId },
      orderBy: { createdAt: "desc" },
    });

    const urlObj = new URL(req.url);
    const deploymentsWithUrl = deployments.map((d) => ({
      ...d,
      url: `${urlObj.origin}/api/deployments/${d.id}/trigger`,
    }));

    return NextResponse.json({ deployments: deploymentsWithUrl });
  } catch (error: any) {
    console.error("Error fetching deployments:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/deployments
 * Saves a new scan configuration as a triggerable deployment profile.
 */
export async function POST(req: Request) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      name,
      targetModel,
      attackerModel,
      judgeModel,
      hardenerModel,
      systemPrompt,
      forbiddenTask,
      judgeInstructions,
      tools,
      mockToolResponses,
    } = body;

    if (!name || !targetModel || !systemPrompt || !forbiddenTask) {
      return NextResponse.json(
        { error: "Missing required fields (name, targetModel, systemPrompt, forbiddenTask)" },
        { status: 400 }
      );
    }

    // Default attacker/judge to target model if not explicitly specified
    const finalAttacker = attackerModel || targetModel;
    const finalJudge = judgeModel || targetModel;
    const finalHardener = hardenerModel || "google/gemini-2.5-flash";

    // Create record
    const deployment = await db.deployment.create({
      data: {
        name,
        targetModel,
        attackerModel: finalAttacker,
        judgeModel: finalJudge,
        hardenerModel: finalHardener,
        systemPrompt,
        forbiddenTask,
        judgeInstructions: judgeInstructions || "",
        tools: typeof tools === "string" ? tools : JSON.stringify(tools || []),
        mockToolResponses: typeof mockToolResponses === "string" ? mockToolResponses : JSON.stringify(mockToolResponses || {}),
        status: "ACTIVE",
        userId: authUser.userId,
      },
    });

    // Determine host origin to generate trigger URL
    const urlObj = new URL(req.url);
    const triggerUrl = `${urlObj.origin}/api/deployments/${deployment.id}/trigger`;

    return NextResponse.json({
      deployment: {
        ...deployment,
        url: triggerUrl,
      },
    });
  } catch (error: any) {
    console.error("Error creating deployment:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
