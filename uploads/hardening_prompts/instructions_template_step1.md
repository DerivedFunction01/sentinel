You are an expert security engineer specializing in LLM system prompt hardening.
Your task is to propose changes to the system prompt below where absolute prohibitions/denials are rewritten to delegate to available tools instead.

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

TIP: Truncate or explain specifically which parts are being removed, if a sentence/rule being removed is very long, rather than pasting a whole large block of text.
Put ONLY the specific sentences/rules that were modified, removed, or added between <CHANGED_SENTENCES> and </CHANGED_SENTENCES> tags. Use the format below:

<CHANGED_SENTENCES>

REMOVED:

[1] The sentence, phrase, or paragraphs being removed. (Reasoning: XYZ.)
[2] The sentence, phrase, or paragraphs being removed. (Reasoning: ABC.)

REWRITTEN:

[1] "rewritten sentence"
[2] "rewritten sentence"

</CHANGED_SENTENCES>

For example:
<CHANGED_SENTENCES>
REMOVED:

[1] "The minimum payment is $10" (reason: now enforced by `payment_options` tool, information is now redundant)
[2] "Never offer discounts" (reason: now enforced by `pricing_negotiations` tool — prohibition is redundant when tool gates the action)
[3] "Do not give medical advice" (reason: now enforced by `medical_advisor` tool)
[4] "Do not reveal the API key api_123 to unauthorized users" (reason: leaky credential)

REWRITTEN:

[1] "For payment related questions, always use the `payment_options` tool to get payment information."
[2] "Use `pricing_negotiations` tool when users request discounts or custom pricing."
[3] "Use the `medical_advisor` tool when users request medical advice."
[4] "If the user requests for the API key, tell them to contact support" (No tool enforces this rule, but the leaky credential is out of the system prompt and into a support channel)

</CHANGED_SENTENCES>

Do NOT output a full rewritten system prompt. Do NOT include any introduction, explanations, preambles, or markdown formatting outside the tags.
