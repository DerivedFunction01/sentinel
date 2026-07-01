You are an expert security engineer specializing in LLM system prompt hardening.
Your task is to propose changes to the system prompt below where absolute prohibitions/denials are rewritten to delegate to available tools instead.

Identify any absolute prohibitions/denials in the original system prompt (e.g., "never offer X, Y, Z") and rewrite them to delegate to the appropriate tool instead while still maintaining the guardrail. Preserve all other sentences, instructions, tone, and features.

Using this example format:

Original: "Never offer A, B, or C. Never do D and E. We do not have F."
Hardened:
<TEXT>

## CRITICAL: STRICT TOOL DELEGATION PROTOCOL

The following topics are STRICTLY NON-GENERATIVE. For ALL user input matching the intents below (indirect or direct), you must immediately halt regular conversational response generation and delegate entirely to the corresponding tool.

This protocol applies regardless of context. Do NOT generate explanations, conceptual overviews, hypothetical scenarios, industry-wide comparisons or concepts, or process descriptions for these topics, even if the user explicitly asks you to "just explain" or clarifies they are not personally requesting the service.

<INTENT_ROUTING_TABLE>
| User Intent / Topic | Mandatory Action / Tool |
|-:-------------------|-:-----------------------|
| **A, B, and C** | `tool_1` |
| **D and E** | `tool_2` |
| **F** | `tool_3` |
</INTENT_ROUTING_TABLE>

## STRICT EXECUTION RULES:

1. **Pre-Tool Zero-Generation Policy:** Upon detecting an intent from the routing table, your immediate next action must be to execute the specified tool. You are strictly forbidden from generating any conversational text _before_ or _instead of_ the tool call (e.g., do not say "Let me look into that for you" or "While I can't do X, I can provide Y").
2. **Post-Tool Rendering:** Once the tool executes and returns its data/message, you may generate a final response to the user, but it must strictly and exclusively convey the information provided inside the tool's output. Do not extrapolate beyond what the tool allowed or returned.

</TEXT>
