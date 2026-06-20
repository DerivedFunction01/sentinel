import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-utils";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const deployment = await db.deployment.findUnique({
      where: { id },
    });

    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    if (deployment.userId !== authUser.userId) {
      return NextResponse.json(
        { error: "Unauthorized access to this deployment" },
        { status: 403 }
      );
    }

    await db.deployment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting deployment:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const deployment = await db.deployment.findUnique({
      where: { id },
    });

    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    if (deployment.userId !== authUser.userId) {
      return NextResponse.json(
        { error: "Unauthorized access to this deployment" },
        { status: 403 }
      );
    }

    const {
      name,
      targetModel,
      attackerModel,
      judgeModel,
      hardenerModel,
      extractorModel,
      systemPrompt,
      forbiddenTask,
      judgeInstructions,
      tools,
      mockToolResponses,
      status,
    } = body;

    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (targetModel !== undefined) dataToUpdate.targetModel = targetModel;
    if (attackerModel !== undefined) dataToUpdate.attackerModel = attackerModel;
    if (judgeModel !== undefined) dataToUpdate.judgeModel = judgeModel;
    if (hardenerModel !== undefined) dataToUpdate.hardenerModel = hardenerModel;
    if (extractorModel !== undefined) dataToUpdate.extractorModel = extractorModel;
    if (systemPrompt !== undefined) dataToUpdate.systemPrompt = systemPrompt;
    if (forbiddenTask !== undefined) dataToUpdate.forbiddenTask = forbiddenTask;
    if (judgeInstructions !== undefined) dataToUpdate.judgeInstructions = judgeInstructions;
    
    if (tools !== undefined) {
      dataToUpdate.tools = typeof tools === "string" ? tools : JSON.stringify(tools);
    }
    if (mockToolResponses !== undefined) {
      dataToUpdate.mockToolResponses = typeof mockToolResponses === "string" ? mockToolResponses : JSON.stringify(mockToolResponses);
    }
    if (status !== undefined) dataToUpdate.status = status;

    const updated = await db.deployment.update({
      where: { id },
      data: dataToUpdate,
    });

    const urlObj = new URL(req.url);
    const triggerUrl = `${urlObj.origin}/api/deployments/${updated.id}/trigger`;

    return NextResponse.json({
      success: true,
      deployment: {
        ...updated,
        url: triggerUrl,
      },
    });
  } catch (error: any) {
    console.error("Error updating deployment:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
