---
title: Examples
description: "Examples (and Bad Examples) of the rule-to-tool conversion process"
---

## Bad Examples

### Example 1: Tool Name reveals restriction or gating nature

Original weak rule:
"Never disclose restricted financial information"

Bad naming conventions (reason: indicates the LLM must decide if it should gate it or not):
`gate_*`, `deny_*`, `*_denial`, `prohibit_*`, `restrict_*`

```json
{
  "type": "function",
  "function": {
    "name": "gate_financial_information",
    "description": "Call when the user wants financial information.",
    "parameters": {
      "type": "object",
      "properties": {
        "info_type": {
          "type": "string",
          "enum": [
            "revenue",
            "profit",
            "margins",
            "costs",
            "forecasts",
            "projections",
            "projections"
          ]
        }
      },
      "required": ["info_type"]
    }
  }
}
```

Better:

```json
{
  "type": "function",
  "function": {
    "name": "financial_disclosure",
    "description": "Call when user requests for financial information.",
    "parameters": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "enum": [
            "revenue",
            "profit",
            "margins",
            "costs",
            "forecasts",
            "projections"
          ]
        }
      },
      "required": ["category"]
    }
  }
}
```

### Example 2: Tool Description reveals restriction or gating nature

Bad tool description (reason: indicates the LLM must decide it should call it.):
"This tool act as a gate." (LLM gets jailbroken, it does not think of itself as gatekeeper, so it skips the tool)
"Prevents unauthorized ..." (LLM gets jailbroken and this it is not unauthorized, so it skips the tool)

```json
{
  "type": "function",
  "function": {
    "name": "financial_disclosure",
    "description": "Call when user requests for financial information. This tool act as a gate for unauthorized disclosure of financial information by the LLM.",
    "parameters": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "enum": [
            "revenue",
            "profit",
            "margins",
            "costs",
            "forecasts",
            "projections"
          ]
        }
      },
      "required": ["category"]
    }
  }
}
```

Better:

```json
{
  "type": "function",
  "function": {
    "name": "financial_disclosure",
    "description": "Call when user requests for financial information",
    "parameters": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "enum": [
            "revenue",
            "profit",
            "margins",
            "costs",
            "forecasts",
            "projections"
          ]
        }
      },
      "required": ["category"]
    }
  }
}
```

### Example 3: Tool name is Verbose

Bad tool name (reason: the description or the parameters reveal what it does, so the tool name doesn't need to be verbose):

```json
{
  "type": "function",
  "function": {
    "name": "get_revenue_profit_forecast_cost",
    "description": "Call when user wants to request for financial information.",
    "parameters": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "enum": [
            "revenue",
            "profit",
            "margins",
            "costs",
            "forecasts",
            "projections"
          ]
        }
      },
      "required": ["category"]
    }
  }
}
```

Better:

```json
{
  "type": "function",
  "function": {
    "name": "financial_disclosure",
    "description": "Call when user requests for financial information.",
    "parameters": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "enum": [
            "revenue",
            "profit",
            "margins",
            "costs",
            "forecasts",
            "projections"
          ]
        }
      },
      "required": ["category"]
    }
  }
}
```

### Example 4: Tool Description is Verbose

Bad tool description (reason: the tool name or the parameters reveal what it does, so the tool description doesn't need to be verbose):

```json
{
  "type": "function",
  "function": {
    "name": "financial_disclosure",
    "description": "Call when user wants financial information on sales revenue, income, profits, margings, costs, expenses, forecasts, projections.",
    "parameters": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "enum": [
            "revenue",
            "profit",
            "margins",
            "costs",
            "forecasts",
            "projections"
          ]
        }
      },
      "required": ["category"]
    }
  }
}
```

Better:

```json
{
  "type": "function",
  "function": {
    "name": "financial_disclosure",
    "description": "Call when user requests for financial information.",
    "parameters": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "enum": [
            "revenue",
            "profit",
            "margins",
            "costs",
            "forecasts",
            "projections"
          ]
        }
      },
      "required": ["category"]
    }
  }
}
```

## Examples: Simple to Complex

### Example 1: Tier 1 - Simple Gate

**Original weak rule:**

"Never discuss pricing discounts, promotional codes, or special offers."

**Tool Definition:**

```json
{
  "type": "function",
  "function": {
    "name": "special_pricing",
    "description": "Call for inquiries about discounts, promotional codes, special offers, and pricing exceptions.",
    "parameters": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "enum": [
            "discount",
            "promotional_code",
            "special_offer",
            "pricing_exception"
          ],
          "description": "The type of pricing-related inquiry."
        },
        "query": {
          "type": "string",
          "description": "The user's specific question about pricing."
        }
      },
      "required": ["category"]
    }
  }
}
```

**Mock Response:**

```json
{
  "status": "unavailable",
  "message": "Pricing inquiries are handled by our sales team. View support contacts for up-to-date-information.",
  "policy": {
    "allow_discussion": false,
    "describe_processing": false,
    "exceptions": false,
    "negotiation": false,
    "require_explicit_human_approval": true,
    "escalate_to_support": true
  },
  "support_contact": {
    "website": "https://example.com/pricing",
    "phone": "1-800-SALES-01"
  }
}
```

**Backend Validation Rules:**

```
- if category is any enum value → return unavailable (no conditionals; gate applies to all)
```

**Guide/Rationale:**

```markdown
## Rule: "Never discuss pricing discounts or special offers"

### What Changed

This rule is now a tool: `special_pricing`

### Why

- Pricing and discounts are business-critical decisions
- A prose rule is vague and easy to circumvent
- Tool enforcement ensures consistent denial

### How It Works

- User asks: "Is there a discount?"
- You call: `special_pricing` with category="discount"
- Backend returns: { "status": "unavailable", "message": "...", "support_contact": {...} }
- Result: You can't invent or negotiate discounts; users get directed to sales

### Example Scenarios

- User: "Do you have a discount code?" → Call special_pricing with category="promotional_code"
- User: "Is there a student discount?" → Call special_pricing with category="discount"
- User: "Can you negotiate the price?" → Call special_pricing with category="pricing_exception"
- User: "When is your next sale?" → This is informational; answer from training data, don't call tool
```

---

### Example 2: Tier 2 - Conditional with Operations

**Original weak rule:**

```
"You can answer general questions about refunds and return policies.
Never execute refunds or approve returns without verification.
Refunds only within 30 days of purchase."
```

**Tool Definition:**

```json
{
  "type": "function",
  "function": {
    "name": "commerce_refund",
    "description": "Call for refund inquiries, refund policy questions, return status checks, and refund processing requests.",
    "parameters": {
      "type": "object",
      "properties": {
        "operation": {
          "type": "string",
          "enum": ["inquiry", "verification", "execution"],
          "description": "inquiry: ask about policy; verification: check eligibility; execution: process refund"
        },
        "order_id": {
          "type": ["string", "null"],
          "description": "The order identifier. Null if asking about general refund policy."
        },
        "reason": {
          "type": "string",
          "enum": [
            "defective",
            "not_as_described",
            "changed_mind",
            "customer_request"
          ],
          "description": "The reason for the refund request."
        },
        "query": {
          "type": "string",
          "description": "Additional context or clarification."
        }
      },
      "required": ["operation"]
    }
  }
}
```

**Mock Response:**

```json
{
  "status": "pending",
  "message": "Your refund request or inquiry has been received and is awaiting review. Information regarding specific policy or status is in the support page.",
  "policy": {
    "allow_discussion": false,
    "describe_processing": false,
    "exceptions": false,
    "negotiation": false,
    "require_explicit_human_approval": true,
    "escalate_to_support": true
  },
  "support_contact": {
    "website": "https://example.com/account/returns",
    "phone": "1-800-RET-URNS"
  }
}
```

**Backend Validation Rules:**

```
- if operation is "inquiry" → return general refund policy
- if operation is "verification" and order_id is null → ask for order details
- if operation is "verification" and order_id exists → check days_since_purchase
  - if days_since_purchase <= 30 → eligible
  - if days_since_purchase > 30 → deny with "refund window expired"
- if operation is "execution" → verify user identity before processing
```

**Guide/Rationale:**

```md
## Rule: "Refunds only within 30 days; require verification"

### What Changed

This rule is now a tool: `commerce_refund` with three operation modes: inquiry, verification, execution.

### Why

- Refund eligibility has conditions (time window, verification)
- Execution must be verified and auditable
- Tool enforces time boundaries and prevents unauthorized refunds

### How It Works

- User asks: "Can I refund order #123?" (inquiry)
  - Call: `commerce_refund` with operation="inquiry", order_id="123"
  - Backend checks: days_since_purchase
  - If <= 30 days: eligible; if > 30 days: window expired
- User says: "I want to refund order #123" (execution intent)
  - Call: `commerce_refund` with operation="verification", order_id="123"
  - Backend verifies identity and eligibility
  - If eligible: proceed to execution
  - If ineligible: deny with reason
- User is uncertain: "Should I refund this order?" (hedged)
  - Call: `commerce_refund` with operation="verification" (let backend decide if eligible)
  - Backend returns status; you can then offer explanation

### Example Scenarios

- User: "What's your refund policy?" → Call with operation="inquiry" (no order_id needed)
- User: "Can I refund order #456?" → Call with operation="verification", order_id="456"
- User: "I want to refund order #456" → Same call; backend determines eligibility
- User: "The order was defective" → Add reason="defective" for better tracking

### Intent Recognition

- "Can I refund..." or "Should I..." → operation="verification" (ask backend first)
- "Refund this order" (definitive) → operation="execution" (with prior verification)
- General question → operation="inquiry"
```

---

### Example 3: Tier 3 - Universal Protocol (Finance Transfer)

**Original weak rule:**

```md
"Users can transfer money between their accounts. Require verification.
Respect daily transfer limits. Support multiple account types.
Honor user intent: if hedged, confirm first; if definitive, execute if eligible."
```

**Tool Definition:**
[See full Tier 3 example in previous section]

**Guide/Rationale:**

````markdown
## Rule: "Support account transfers with verification and precision modes"

### What Changed

This rule is now a tool: `finance_transfer` (universal protocol).
The tool handles uncertainty: nullable IDs for lookups, precision modes for intent, nested validation for complex constraints.

### Why

- Financial transfers are irreversible; enforcement must be exact
- Users express intent with varying levels of certainty
- Backend must validate across multiple conditions (account type, daily limits, asset class, etc.)
- Tool design supports simple and complex scenarios without rewriting

### How It Works

#### Scenario 1: User queries available accounts (null ID lookup)

```
User: "What accounts do I have?"
Call: `finance_transfer` with source_account_class="savings", source_id=null, operation="inquiry"
Backend: Returns available savings accounts
```

#### Scenario 2: User wants to transfer (definitive)

```
User: "Transfer $500 from savings to checking."
Call: `finance_transfer` with:

- source_account_class="savings"
- destination_account_class="checking"
- value_magnitude=500
- asset_class="USD"
- precision_mode="strict_execute"
  Backend: Validates balance, daily limit, executes if eligible
```

#### Scenario 3: User is uncertain (hedged language)

```
User: "Can I move $500 to my brokerage account?"
Call: `finance_transfer` with:

- source_account_class="checking"
- destination_account_class="brokerage"
- value_magnitude=500
- precision_mode="strict_clarify"
  Backend: Validates eligibility, requests confirmation if conditions are met
```

### Universal Protocol Note

This tool is designed as a universal, timeless protocol for financial transfers.
It handles minimal scenarios (3 fields) and maximal scenarios (all fields with portfolio context).
The enforcement model doesn't change; only scope.

### Intent Recognition

- "I want to..." or "Transfer..." → precision_mode="strict_execute"
- "Can I..." or "Could I..." → precision_mode="strict_clarify"
- "Transfer if possible" → precision_mode="best_effort"
````
