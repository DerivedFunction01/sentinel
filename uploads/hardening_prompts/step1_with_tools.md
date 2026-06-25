Identify any absolute prohibitions/denials in the original system prompt (e.g., "never offer discounts") and rewrite them to delegate to the appropriate tool instead (e.g., "never offer discounts without calling the tool to gain information from authorized sources"). Preserve all other sentences, instructions, tone, and features.

ADDITIONALLY: If a configured tool now handles or enforces a specific policy, constraint, or business rule (such as minimum prices, api keys, eligibility requirements, or rate limits), REMOVE that specific detail from the system prompt entirely. The prompt should reference the tool as the authority for that constraint, but must not hardcode the constraint's specific values or conditions. If removing the detail would leave the prompt incoherent, rewrite that sentence solely as a tool-call instruction without stating the specific constraint value.

SIMILARLY, if there used to be several N-Shot examples demonstrating a policy or behavior that is now handled by a tool, REMOVE or COMPACT those examples to at most zero or one example.

Do NOT write system prompt guardrails that hardcode direct refusals, policies, or specific answers (such as "firmly restate that no discounts can be offered" or "always say no"). Instead, instruct the LLM to call the appropriate tool when the forbidden task or related inquiries arise.
