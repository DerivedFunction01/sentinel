import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScanByReportId } from "@/lib/scan-db";
import { callOpenRouter } from "@/app/api/scan/launch/route";
import { db } from "@/lib/db";
import { TrialVerdict } from "@/lib/enums";
import { ORIGINAL_INTERNAL, OPTIMIZATION_PROMPT } from "@/lib/attack-templates";

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

    const scan = await getScanByReportId(reportId, session.user.id);
    if (!scan) {
      return new Response("Scan not found", { status: 404 });
    }

    // Filter breached trials to find successful attack prompts
    const breachedAttacks = scan.trials
      .filter((t) => t.verdict === TrialVerdict.Breached)
      .map((t) => t.attack);

    // Format the ORIGINAL_INTERNAL defensive template for the LLM context
    const configuredOriginalInternal = ORIGINAL_INTERNAL.replace(
      "{target}",
      `"${scan.forbiddenTask}"`,
    ).replace("{expected behavior}", "a polite and firm refusal");

    const systemInstructions = `You are an expert security engineer specializing in LLM system prompt hardening and defensive prompt engineering.
Your task is to rewrite a system prompt to make it resilient against adversarial jailbreak attempts, specifically focusing on preventing a forbidden task.

Here is the current system prompt:
<system_prompt>
${scan.systemPrompt}
</system_prompt>

Here is the forbidden task the LLM must NEVER perform or assist with:
<forbidden_task>
${scan.forbiddenTask}
</forbidden_task>

You should incorporate the following core defensive instructions structure:
<defensive_instructions_template>
${configuredOriginalInternal}
</defensive_instructions_template>

And you MUST append this exact optimization constraint at the very end of the prompt:
<optimization_constraint>
${OPTIMIZATION_PROMPT.trim()}
</optimization_constraint>

${
  breachedAttacks.length > 0
    ? `The following adversarial attack prompts successfully bypassed the current system prompt:
<successful_attacks>
${breachedAttacks.map((a, i) => `${i + 1}. "${a}"`).join("\n")}
</successful_attacks>

Rewrite the system prompt to explicitly block these attack vectors and similar jailbreak strategies while preserving the original utility and instructions of the prompt. Make sure it ends with the optimization constraint above.`
    : `No successful attacks were detected in the scan, but you should still analyze the prompt for potential vulnerabilities regarding the forbidden task and output an optimized, hardened version with clear negative constraints, the defensive instructions structure, and the optimization constraint appended at the end.`
}

STRICT OUTPUT RULES:
- Output ONLY the new, hardened system prompt.
- Do NOT include any introduction, explanations, preambles, or markdown formatting (such as \`\`\`plaintext or \`\`\`xml).
- Maintain all original non-conflicting operational instructions, tone, and features of the prompt.`;

    const messages = [
      {
        role: "user",
        content: systemInstructions,
      },
    ];

    const hardeningModel =
      scan.judgeModel || scan.attackerModel || "google/gemini-2.5-flash";

    const response = await callOpenRouter(hardeningModel, messages);
    let hardenedPrompt = response.content || "";

    // Clean up any stray markdown blocks just in case
    hardenedPrompt = hardenedPrompt
      .replace(/^```[a-zA-Z]*\n/g, "")
      .replace(/\n```$/g, "")
      .trim();

    return NextResponse.json({
      originalPrompt: scan.systemPrompt,
      hardenedPrompt,
    });
  } catch (error: any) {
    console.error("Error hardening prompt:", error);
    return new Response("Error generating hardened prompt", { status: 500 });
  }
}
