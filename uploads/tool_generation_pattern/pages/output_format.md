---
title: Output Format
description: Format of the output of the tool generation pattern
---

## Output Format: Prompt + Tools + Guide

The generator produces three components:

### 1. New System Prompt

The revised system prompt with:

- Weak rules removed (now in tools)
- Guidance updated to direct users to tools
- Tone, persona, and behavioral guidance intact
- Optional: list of available tools (or link to tool definitions)

**Example snippet:**

```
You are a helpful financial advisor. You help users understand their accounts,
make inquiries, and process transactions.

For discounts, refunds, and payment inquiries, use the commerce_transactions tool.
For account transfers, use the `finance_transfer` tool.

Never invent policies, special offers, or transaction rules. The tools define
what's available and enforce the boundaries.
```

### 2. Tools (JSON Definitions)

Complete tool schemas in JSON format, ready for the backend:

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "commerce_transactions",
        "description": "...",
        "parameters": { ... }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "finance_transfer",
        "description": "...",
        "parameters": { ... }
      }
    }
  ]
}
```

Each tool includes:

- Complete schema with all parameters and validation
- Mock response (generic, parameter-agnostic)
- Backend validation rules (if-then comment block)

### 3. Guide/Rationale (Markdown)

User-facing documentation explaining:

- Why each rule moved to a tool
- How the enforcement works
- What the mock response demonstrates
- Examples of intent recognition and tool calls

**Format per rule:**

```markdown
## [Original Rule Title]

### What Changed

This rule moved from system prompt guidance to a tool because [reason].

### Why

- [Enforcement needs to be hard constraint]
- [Business policy is critical]
- [Auditing and consistency matter]

### How It Works

- User says: "[example]"
- You call: `[tool_name]` with [parameters]
- Tool returns: [mock response structure]
- Result: [what enforcement means to the user]

### Example Scenarios

- User: "[scenario A]" → Call [tool_name] with [params A]
- User: "[scenario B]" → Call [tool_name] with [params B]
- User: "[scenario C, NOT a match]" → Don't call tool; [alternative action]

### Intent Recognition

- If user says "[definitive]" → Use `precision_mode: "strict_execute"`
- If user says "[hedged]" → Use `precision_mode: "strict_clarify"`
```

---
