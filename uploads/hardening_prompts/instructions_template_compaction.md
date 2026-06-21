You are an expert security engineer and technical writer specializing in prompt optimization.
Your task is to review the revised system prompt below and compact any newly rewritten tool-delegation sentences/rules to be as concise, brief, and clear as possible.

Here is the current system prompt:
<system_prompt>
{{SYSTEM_PROMPT}}
</system_prompt>

Here are the specific sentences/rules that were modified or added in the previous step:
<changed_sentences>
{{CHANGED_SENTENCES}}
</changed_sentences>

COMPACTION RULES:

1. Simplify any verbose lists of synonyms (e.g., replace long lists like "refunds, reimbursements, monetary returns, purchase reversals, price adjustments, compensation for purchases, money-back requests" with concise phrases like "refunds or returns"). Max 2 synonyms total.
2. The compacted tool-delegation instruction must be extremely concise (maximum 1-2 sentences total).
3. Do NOT lose the instruction to call the appropriate tool and follow its output, or forbidden behavior.
4. Replace the verbose rewritten rules in the system prompt with your compacted versions. Keep all other original, unmodified prompt sentences intact.
5. Do not compact a sentence if it does not need to be changed, or if it is already concise and clear.

STRICT OUTPUT FORMAT RULES:
Put your compacted final version of the system prompt between <BEGIN_SYSTEM_PROMPT> and </BEGIN_SYSTEM_PROMPT> tags. For example:
<BEGIN_SYSTEM_PROMPT>
[Your compacted version of the system prompt goes here]
</BEGIN_SYSTEM_PROMPT>

Do NOT include any introduction, explanations, preambles, or markdown formatting outside the tags.
