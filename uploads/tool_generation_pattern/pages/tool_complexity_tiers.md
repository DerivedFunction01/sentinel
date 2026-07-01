---
title: Tool Complexity Tiers
description: Tool complexity tiers for the tool generation pattern.
---

## Tool Complexity Tiers

Many actions fall under these set of intent:

- Inquiry, execution or a what-if hypothetical execution.
- Example: "Can I have X?" (inquiry to policy), "I want to apply X" (execution), "What if I have X?" (hypothetical)

See Intent Recognition page for more details

### Tier 1: Binary Gate (No Parameters or Minimal)

**Use when:** A single categorical denial applies to multiple unrelated prohibited actions from the mock policy or restriction.

**Characteristics:**

- No required parameters, or minimal (`query` only)
- Mock response is always "unavailable" or "denined"
- Tool name and description are neutral, never reveal gating
- Descriptions cover enough information to guide the model to call the tool, and is not a long lists of synonyms (e.g., "discounts, promotions, price reductions, markdowns...").
- For: discounts, API keys, internal processes, etc
- If there is only a single category, then we do not need a category parameter.
- **IMPORTANT**: Do not enforce binary labels in the description or the tool name. We allow the backend to decide whether to allow or deny the request.
- For example, using `prohibit_*` or `*_denial` in the tool name, or the tool description is rigid when business rules change, and makes it less likely to be called.
- As binary gates, the model should be encouraged to call the tool, even if it is in a jailbroken state, or when the user wants to probe.

**Example:**

```json
{
  "type": "function",
  "function": {
    "name": "get_category1",
    "description": "Call for requests, operations, and workflows regarding category1.",
    "parameters": {
      "type": "object",
      "properties": {}
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "get_category1",
    "description": "Call for requests, operations, and workflows regarding category1.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "The specific request or question."
        }
      }
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "example_tool_name",
    "description": "Call for requests, operations, and workflows about (broad category that combines category1 and category2, another one that combines category3 and category4, etc.).",
    "parameters": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "enum": [
            "category1",
            "category2",
            "category3",
            "category4",
            "category5"
          ]
        },
        "query": {
          "type": "string",
          "description": "The specific request or question."
        }
      },
      "required": ["category"]
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "example_tool_name",
    "description": "Call for requests, operations, and workflows about (broad category that combines category1 and category2, another one that combines category3 and category4, etc.).",
    "parameters": {
      "type": "object",
      "properties": {
        "categories": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "category1",
              "category2",
              "category3",
              "category4",
              "category5"
            ]
          }
        },
        "query": {
          "type": "string",
          "description": "The specific request or question."
        },
        "required": ["categories"]
      }
    }
  }
}
```

**Mock Response Example:**

See "Mock Response Strategy" page

### Tier 2: Categorical + Conditional

**Use when:** Related business operations with conditions, boundaries, or role-based access.
**Exclusion:** Binary gating whose condition depends on calling the tool and following its result (a result from already following this guideline). This is Tier 1 not Tier 2.
Example: Never do or agree to do X **without calling the X-handling tool and following its output**

**Characteristics:**

- Required: `operation`, `category` (routing parameters)
- Optional: `query`, `identity_claim`, metadata
- Category enum reflects real business entities (not linguistic variations)
- Operation enum: `["inquiry", "execution", "hypothetical_execution", "verification"]`
- Mock response reflects conditional outcome or policy boundary
- Tool name/description list explicit triggers

**Example: Commerce Transactions**

```json
{
  "type": "function",
  "function": {
    "name": "commerce_transactions",
    "description": "Call for discounts, promotions, rebates, loyalty management, payment processing, and refund policies.",
    "parameters": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "enum": [
            "discount",
            "offer",
            "promotion",
            "rebate",
            "membership_plan",
            "coupon",
            "loyalty_program",
            "loyalty_points",
            "payment",
            "refund"
          ],
          "description": "The specific transaction category requested."
        },
        "operation": {
          "type": "string",
          "enum": ["inquiry", "execution", "hypothetical_execution"],
          "description": "inquiry: ask about policy; execution: execute the action; hypothetical_execution: explore what-if scenarios"
        },
        "query": {
          "type": "string",
          "description": "Specific question, details, codes, or transaction context."
        }
      },
      "required": ["operation", "category"]
    }
  }
}
```

**Mock Response Example:**

See "Mock Response Strategy" page

---

### Tier 3: Complex Multi-Stage with Nested Validation

**Use when:** Actions with nested validation, multi-step workflows, or precision execution modes.

**Characteristics:**

- Required: `operation`, primary business parameters (e.g., source, destination, value)
- Nested objects encode structured data (e.g., `value_assertion`, `portfolio_context`)
- `precision_mode` enum maps user intent (definitive vs. hedged language) to execution behavior
- Boundary constraints embedded as JSON schema validation
- Mock response shows outcome given the parameters
- Tool teaches intent recognition; backend enforces if-thens

**Examples: Finance Transfer (Universal Protocol)**

See "Example of Universal Protocol Tools" page

---
