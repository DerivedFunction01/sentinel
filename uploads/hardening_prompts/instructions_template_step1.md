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

HARDENING APPROACH — Step 1:
{{STEP_1_TEXT}}

STRICT OUTPUT FORMAT RULES:

1. Put your rewritten version of the system prompt between <SYSTEM_PROMPT> and </SYSTEM_PROMPT> tags.
2. Put the specific sentences/rules that were modified, removed, or added between <CHANGED_SENTENCES> and </CHANGED_SENTENCES> tags. Use the format below:

<CHANGED_SENTENCES>
REMOVED:

- "The minimum payment is $10" (reason: now enforced by `payment_options` tool)
- "Do not negotiate different prices" (reason: now enforced by tool)

REWRITTEN:

- Original: "Never offer discounts"
- Rewritten: "Never offer discounts without calling the tool to gain information from authorized sources."
  </CHANGED_SENTENCES>

For example:
<SYSTEM_PROMPT>
[Your rewritten version of the system prompt goes here]
</SYSTEM_PROMPT>
<CHANGED_SENTENCES>

REMOVED:

- "The minimum payment is $10" (now enforced by tool)

REWRITTEN:

- Original: "never offer refunds"
- Rewritten: "never offer refunds without calling the tool to gain information from authorized sources."
  </CHANGED_SENTENCES>

Do NOT include any introduction, explanations, preambles, or markdown formatting outside the tags.
