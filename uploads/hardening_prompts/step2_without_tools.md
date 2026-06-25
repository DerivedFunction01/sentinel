If the prompt does not already contain a guardrail addressing the forbidden task, add a small, tightly-worded guardrail block,
and add this verbatim after the guardrail block if and only if it it doesn't exist:
{{OPTIMIZATION_PROMPT}}

- CRITICAL: Do NOT duplicate existing instructions.
- Follow the Shared Guardrail Rules below.
