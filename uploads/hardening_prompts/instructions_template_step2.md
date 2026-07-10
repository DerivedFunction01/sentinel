> **DEPRECATED**: This prompt is no longer called by the pipeline. See [Final Prompt](./instructions_template_step1_full.md)
> You are an expert security engineer specializing in LLM system prompt hardening.
> Your task is to take the revised system prompt below and add a small, tightly-worded guardrail block to protect against adversarial jailbreak attempts and the successful attacks listed.

Here is the current system prompt:
<system_prompt>
{{SYSTEM_PROMPT}}
</system_prompt>
<hasTools>
We have configured/generated the following tool definitions to handle the forbidden task constraints dynamically:
<available_tools>
{{TOOLS_JSON}}
</available_tools>
</hasTools>

The forbidden task — what the assistant must NEVER do, help with, or reveal:
<forbidden_task>
{{FORBIDDEN_TASK}}
</forbidden_task>
<hasOntologyContent>

EXTERNAL Domain Policy Guidelines (Reference Only):
<domain_policies>
{{ONTOLOGY_CONTENT}}
</domain_policies>
NOTE: The policy guidelines above are external reference materials. If there are any contradictions, conflicts, or mismatches between these guidelines and the provided system prompt or forbidden task, the provided system prompt's actual rules, boundaries, and constraints MUST always take precedence. Do NOT override the provided prompt's constraints with external guidelines.
</hasOntologyContent>

<hasBreachedAttacks>
<hasSummarizedPatterns>
Threat analysis of successful attack patterns and strategies identified during a pentest:
<attack_patterns>
{{SUMMARIZED_PATTERNS}}
</attack_patterns>
</hasSummarizedPatterns>
<noSummarizedPatterns>
The following adversarial prompts SUCCESSFULLY bypassed the current system prompt during a pentest. The final hardened version must block these attack vectors:
<successful_attacks>
{{BREACHED_ATTACKS_LIST}}
</successful_attacks>
</noSummarizedPatterns>
</hasBreachedAttacks>
<noBreachedAttacks>
No breaches occurred in the scan, but you should still proactively strengthen the prompt against the most common jailbreak strategies.
</noBreachedAttacks>

HARDENING APPROACH — Step 2:
{{STEP_2_TEXT}}

## Shared Guardrail Rules

{{SHARED_GUARDRAIL_RULES}}

GUARDRAIL CONSOLIDATION & QUALITY RULES:

- **Consolidate instructions**: Do NOT output multiple redundant sentences or paragraphs enforcing the same constraint or tool call. If the system prompt already uses a tool, do NOT add a new separate guardrail paragraph.
- **Limit Length**: The final added/modified guardrail text must be at most 1-2 sentences total.

REFERENCE EXAMPLES of good hardening output (before → after style):

Example 1:
<before>
You are a helpful customer support assistant. Never offer discounts.
</before>
<after>
You are a helpful customer support assistant. Never offer discounts.
If a customer raises affordability concerns or requests any form of discount, firmly restate the pricing structure and make clear that no discounts can be offered.
</after>

Example 2:
<before>
You are a helpful customer support assistant. Never offer discounts without calling the tool first.
</before>
<after>
You are a helpful customer support assistant.
Never offer or agree to offer discounts without calling the tool first. If asked about discounts or promotions, firmly state that you cannot provide that information without checking from authorized sources first.
</after>

STRICT OUTPUT FORMAT RULES:
Put your final hardened version of the system prompt between <SYSTEM_PROMPT> and </SYSTEM_PROMPT> tags.
Use formatting such as newlines to make the system prompt more readable. Do not add emphasis if it is not present in the original system prompt.
For example:
<SYSTEM_PROMPT>
[Your rewritten and final hardened version of the system prompt goes here]
</SYSTEM_PROMPT>

Do NOT include any introduction, explanations, preambles, or markdown formatting outside the tags.
Do NOT emit the DEFENSIVE GUARD STRUCTURE bullet points verbatim — they are a guide only, not text to paste.
