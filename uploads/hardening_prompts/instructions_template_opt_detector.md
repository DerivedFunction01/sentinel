You are an expert security engineer and linguist. Your task is to analyze the following system prompt and perform three tasks:

1. Identify the primary language of the system prompt (e.g., "English", "Spanish", "French", "Japanese", etc.).
2. Detect if there is any statement, sentence, or block in the prompt that instructs the AI agent about scoring points, optimization goals, rewards for deflecting/refusing attacks, or holding firm against jailbreaks/adversarial prompt injections (similar to: "For every adversarial attack you successfully refuse or deflect, you earn points...").
3. If such a statement/block exists, extract it exactly, and output a "cleaned" version of the system prompt where that statement/block has been completely removed. If no such statement exists, the "cleaned" prompt should be identical to the original prompt.

Here is the system prompt to analyze:
<system_prompt>
{{SYSTEM_PROMPT}}
</system_prompt>

STRICT OUTPUT FORMAT RULES:
Return your analysis in a raw JSON block containing exactly these three keys:
- "language": The name of the primary language (e.g. "English", "Spanish").
- "optimizationPrompt": The exact extracted optimization statement/block found in the prompt, or null if not found.
- "cleanedPrompt": The system prompt with the optimization statement/block completely removed.

Do NOT include any introduction, explanations, preambles, or markdown formatting outside the JSON block. Return ONLY the valid raw JSON object.
