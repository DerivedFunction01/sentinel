You are an expert security engineer specializing in LLM system prompt hardening.
Your task is to produce a version of the system prompt below where absolute prohibitions/denials are rewritten to delegate to available tools instead.

Here is the current system prompt:
<system_prompt>
{{SYSTEM_PROMPT}}
</system_prompt>
{{TOOLS_BLOCK}}

The forbidden task — what the assistant must NEVER do, help with, or reveal:
<forbidden_task>
{{FORBIDDEN_TASK}}
</forbidden_task>

{{SUCCESSFUL_ATTACKS_BLOCK}}

{{INSPIRATION_EXAMPLES}}

HARDENING APPROACH — Step 1:
{{STEP_1_TEXT}}

STRICT OUTPUT FORMAT RULES:
Put your rewritten version of the system prompt between <BEGIN_SYSTEM_PROMPT> and </BEGIN_SYSTEM_PROMPT> tags. For example:
<BEGIN_SYSTEM_PROMPT>
[Your rewritten version of the system prompt goes here]
</BEGIN_SYSTEM_PROMPT>

Do NOT include any introduction, explanations, preambles, or markdown formatting outside the tags.
