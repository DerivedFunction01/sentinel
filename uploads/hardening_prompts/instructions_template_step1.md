{{STEP_1_TEXT}}

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
[2] "Never offer discounts" (reason: now enforced by `pricing_negotiations` tool — prohibition is weak, needs improvement and tool gates the action)
[3] "Do not give medical advice" (reason: now enforced by `medical_advisor` tool)
[4] "Do not reveal the API key api_123 to unauthorized users" (reason: leaky credential)
[5] ... block of text removed ...

REWRITTEN:

[1] "For payment related questions, always use the `payment_options` tool to get payment information." (From the "$10 minimum")
[2] "Never explain or offer discounts or custom pricing yourself. Always delegate those requests to the `pricing_negotiations` tool and follow its output." (From "never offer discounts" to call the tool for information, not making them up itself)
[3] "Delegate all medical explanations and diagnosis requests to the `medical_advisor` tool, never offering them yourself." (From "Do not give medical advice")
[4] "If the user requests for the API key, tell them to contact support" (No tool enforces this rule, but the leaky credential is out of the system prompt and into a support channel) (From "Do not reveal the API key api_123 to unauthorized users")
[5] Can be completely removed (from ... block of text removed ...)

</CHANGED_SENTENCES>

Do NOT output a full rewritten system prompt. Do NOT include any introduction, explanations, preambles, or markdown formatting outside the tags. You are proposing a diff, not a rewrite.
