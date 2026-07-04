import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { getCachedDbModels } from "@/lib/models-cache";
import { type ToolDef, type SeedInfo } from "@/lib/types";
import { calculateUpfrontScanHold } from "@/lib/token-utils";

interface PromptPayload {
  systemPrompt: string;
  forbiddenTask: string;
  judgeInstructions: string;
  tools: string;
  mockResponses: string;
  allowNoToolsFallback?: boolean;
  cachedSeedInfo?: SeedInfo;
}

interface PromptConfig {
  systemPrompt: string;
  forbiddenTask: string;
  judgeInstructions: string;
  tools: ToolDef[];
  mockToolResponses: Record<string, unknown>;
  allowNoToolsFallback?: boolean;
  cachedSeedInfo?: SeedInfo;
}

export async function POST(req: Request) {
  // Authenticate via session OR Bearer API key
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Auth is verified; we don't need to query the user table here.
  // The client already knows its token balance.

  const body = await req.json().catch(() => ({}));

  const targetModels: string[] = Array.isArray(body.targetModels)
    ? body.targetModels
    : body.targetModel
      ? [body.targetModel]
      : [];

  const promptsRaw: PromptPayload[] = Array.isArray(body.prompts)
    ? body.prompts
    : [
        {
          systemPrompt: (body.systemPrompt as string) || "",
          forbiddenTask: (body.forbiddenTask as string) || "",
          judgeInstructions: (body.judgeInstructions as string) || "",
          tools: (body.tools as string) || "",
          mockResponses: (body.mockResponses as string) || "",
          allowNoToolsFallback: !!body.allowNoToolsFallback,
          cachedSeedInfo: body.cachedSeedInfo as any,
        },
      ];

  const dbModels = await getCachedDbModels();

  const seedExtractorModel = (body.seedExtractorModel as string) || "";
  const attackGeneratorModel =
    (body.attackerModel as string) ||
    (body.attackGeneratorModel as string) ||
    "";
  const judgeModel = (body.judgeModel as string) || "";
  const hardenerModel = (body.hardenerModel as string) || "";
  const extractorModel = (body.extractorModel as string) || "";
  const enableHardening = body.enableHardening !== false;

  const parsedPrompts: PromptConfig[] = promptsRaw.map((p) => {
    let tools: ToolDef[] = [];
    let mockToolResponses: Record<string, unknown> = {};
    try {
      tools = p.tools ? (JSON.parse(p.tools) as ToolDef[]) : [];
    } catch {
      /* keep empty */
    }
    try {
      mockToolResponses = p.mockResponses
        ? (JSON.parse(p.mockResponses) as Record<string, unknown>)
        : {};
    } catch {
      /* keep empty */
    }
    return {
      systemPrompt: p.systemPrompt,
      forbiddenTask: p.forbiddenTask,
      judgeInstructions: p.judgeInstructions,
      tools,
      mockToolResponses,
      allowNoToolsFallback: !!p.allowNoToolsFallback,
      cachedSeedInfo: p.cachedSeedInfo,
    };
  });

  const upfrontHold = calculateUpfrontScanHold(
    parsedPrompts,
    targetModels,
    seedExtractorModel,
    attackGeneratorModel,
    judgeModel,
    dbModels,
    enableHardening,
    hardenerModel,
    extractorModel,
  );

  return NextResponse.json({
    success: true,
    upfrontHold,
  });
}
