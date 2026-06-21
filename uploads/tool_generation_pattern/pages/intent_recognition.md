---
title: Intent Recognition
description: Intent recognition for the tool generation pattern.
---

## Intent Recognition & Precision Encoding

- Many operations fall into these categories: inquiry, execution or a what-if hypothetical execution.
- Example: "Can I have X?" (inquiry to policy), "I want to apply X" (execution), "What if I have X?" (hypothetical)
- However, certain regulatory actions may require far beyond it.

### Why Intent Matters

The generator must teach the LLM to recognize user intent because tools encode **execution modes**, not just **blocking logic**.

**Example:**

User says: "I want to transfer $500" (definitive)
→ `precision_mode: "strict_execute"` → Backend executes if conditions met, such as compliance checks and consent

User says: "Should I transfer $500?" (hedged)
→ `precision_mode: "strict_clarify"` → Backend requests confirmation, then the user confirm for execution.

User says: "Transfer $500 if possible" (tentative)
→ `precision_mode: "best_effort"` → Backend executes with fallbacks

### Recognizing Definitive vs. Hedged Language

**Definitive (strict_execute):**

- "I want to", "I need to", "Transfer $500"
- "Refund this order"
- "Move my money from savings to checking"

**Hedged (strict_clarify):**

- "Should I", "Can I", "Would it be possible to"
- "Should I refund this order?"
- "Could I move my money?"

**Best effort (best_effort):**

- "Try to", "If possible", "If you can"
- "Transfer $500 if available"

### If-Then Encoding in Tools

For each conditional rule, the schema and mock encode the boundary:

```
Requirement: "Refund only within 10 minutes, in-store only"

Tool Parameters:
- Capture minutes_since_purchase via query/order_id lookup
- Capture location via system context (not user input)

If-Then Logic (Backend Rules):
- if minutes_since_purchase <= 10 AND location is "in_store" → approve
- if minutes_since_purchase > 10 → deny with "refund window expired"
- if location is not "in_store" → deny with "refunds available in-store only"

Mock Response (Agnostic):
- Always return "pending" + link to account where real status appears
```

### Intent Labels for the New Prompt

When the generator outputs the new system prompt, it includes examples:

```md
WHEN TO CALL `finance_transfer`:

- User says "I want to transfer $500" → call with precision_mode: "strict_execute"
- User says "Should I transfer $500?" → call with precision_mode: "strict_clarify"
- User says "Transfer $500 if possible" → call with precision_mode: "best_effort"

WHEN NOT TO CALL:

- If user is asking about banking transfer policies, or for operations not related to banking
```
