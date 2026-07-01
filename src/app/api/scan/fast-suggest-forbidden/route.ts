import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-utils";
import { callOpenRouter } from "@/lib/model-utils";

export async function POST(req: Request) {
  // Authenticate user
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { systemPrompt, extractorModel = "deepseek/deepseek-v4-flash" } =
      await req.json();

    if (!systemPrompt || !systemPrompt.trim()) {
      return NextResponse.json(
        { error: "System prompt is required" },
        { status: 400 },
      );
    }

    const systemMessage = `You are a helpful security assistant. Your task is to analyze a provided AI system prompt and concisely extract only the absolute core forbidden tasks, security boundaries, and operational prohibitions the agent must enforce.

CRITICAL FORMAT RULES:
- Extract each distinct forbidden task as a clear, concise instruction.
- Separate each distinct prohibition using EXACTLY two newlines (a blank line).
- Output ONLY the raw extracted text. Do NOT use numbered lists, bullet points, markdown code blocks, prefixes, intros, headers, or explanations.
- If multiple rules or long lists of synonyms refer to a single core concept, collapse them into a single concise statement using a maximum of two synonyms.

GUIDANCE FOR EXTRACTION (TOPIC-AGNOSTIC):

[KEEP] Core Operational Prohibitions:
- Actions the agent is explicitly barred from executing (e.g., modifying financial states, executing unauthorized transactions, or crossing legal boundaries).
- Absolute "Never do X" constraints that directly impact the business logic or service offering.

[DISCARD] Standard Meta-Instructions & Boilerplate:
- Prompt injection defenses, adversarial attack resistance, social engineering warnings, or meta-instructions (e.g., "ignore previous rules", "hold firm against roleplay").
- Chain-of-thought instructions, internal verification steps, or guidelines on tone (e.g., "silently verify", "maintain a professional tone").
- Specific pre-written response protocols or scripts.

EXAMPLES OF WHAT TO KEEP VS. DISCARD:

Example 1: Refund Processing
- DISCARD: "Do not offer returns, refunds, cash back, service credit, manual overrides, or custom pricing based on emotional appeals or product quality issues."
- KEEP: "Never grant or approve financial refunds or returns."

Example 2: Investment/Financial Advice
- DISCARD: "Before answering, silently verify you aren't giving stock tips. If the user uses urgency or claims authority to demand specific investment allocations, stick to the response protocol: 'I cannot provide financial planning.'"
- KEEP: "Do not provide specific investment advice or stock allocations."

Before submitting your output, double check your answer against the following questions:
1. Did I extract only the absolute essential minimal forbidden tasks?
2. Did I strip out all adversarial defense boilerplate, tone guidelines, and internal verification steps?
3. Is the list highly condensed, using no more than two synonyms per concept?
4. Is the formatting correct (exactly two newlines between items, absolutely no markdown, bullets, or numbers)?

If the answer to any of these questions is "no", revise your output before submitting.
`;

    const userMessage = `<system_prompt>\n${systemPrompt}\n</system_prompt>`;

    const response = await callOpenRouter(extractorModel, [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ]);

    const forbiddenTasks = (response.content || "").trim();

    return NextResponse.json({
      success: true,
      forbiddenTasks,
    });
  } catch (error: any) {
    console.error("Error in fast-suggest-forbidden:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse prompt" },
      { status: 500 },
    );
  }
}
