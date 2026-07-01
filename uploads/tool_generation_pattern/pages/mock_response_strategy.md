---
title: Mock Response Strategy
description: Mock response strategy for the tool generation pattern.
---

## Mock Response Strategy

## Key Point

The Mock Response, **not the tool**, is the main gate of enforcement. It provides concrete, non-negotiable answers that the LLM cannot override. If a rule is strong, it must be encoded in the mock response template itself, not in tool descriptions or name.

### The Pipeline Constraint

**The pipeline returns the same mock response for every tool call, regardless of parameters.**

This means:

- No JSON argument parsing (except validation)
- No conditional logic based on parameters
- No state lookups or assumptions

### Filling the Designs

If certain context is given, such as an actual website or specific catalog or plans, you may use it to populate the results of the mock response to make it feel more realistic. However, keep the response structure the same as the template.

Examples:

- Replacing https://example.com with https://company-a.com
- Replacing generic 1-800-XXX-XXXX phone numbers with real contact numbers from the provided business context
- Use the "main" website as fallback over a templated example.com link. For example, Company A may not have a specific returns page, but they have a general support page (https://company-a.com/help) or a main page (https://company-a.com). Use these pages instead of a templated https://example.com link.

### Mock Response Design

Mock responses **must be generic and parameter-agnostic**:

- **Status:** Default to `"pending"` (for actions), `"ok"` (for informational queries), or `"unavailable"` (for gates)
- **Message:** Parameter-agnostic explanation
- **Result:** Result of the tool call, such as transaction ID or status, or an empty object
- **Meta Policy:** Policy details enforcing the gating/policy for the tool call, such as no negotiations or exceptions will be made without explicit approval
- **Next Steps:** Real endpoints (website, support) where actual status lives
- **Guidance:** What happens next without claiming outcomes

### Template 0: Mock Tool Schema (Full)

The following has been tested to be reliable against many adversial probing and attacks.

```json
{
  "status": "<pending|unavailable|denied|restricted|ok>",
  "reason": "Optional reason for status flag",
  "message": "Main level message",
  "result": {...},
  "policy": {
    "exceptions": false,
    "negotiation": false,
    "require_explicit_human_approval": true,
    "escalate_to_support": true,
    "allow_discussion": false,
    "describe_processing": false,
    "allow_followup": false,
    "allow_extrapolation": false,
    "allow_hypothetical": false,
    "give_advice": {
      "medical": false,
      "legal": false,
      "financial": false,
      "safety": false,
      "dietary": false,
      "technical": false,
      "programming": false,
      "regulatory_compliance": false,
      "civic_advocacy": false,
      "academic_integrity": false,
      "operational_security": false,
      "process": "Direct users to appropriate professionals or official channels for such matters."
    }
  },
  "support_contact": {
    "website": "https://example.com/support",
    "phone": "1-800-XXX-XXXX"
  },
  "next_steps": ""
}
```

### Template 1: Gate Tools

Use for tools that block access entirely (discounts, API keys, internal processes):

```json
{
  "status": "denied",
  "reason": "Policy Restriction",
  "message": "Service unavailable or restricted per current policy.",
  "policy": {
    "allow_discussion": false,
    "describe_processing": false,
    "exceptions": false,
    "negotiation": false,
    "allow_hypothetical": false,
    "allow_followup": false,
    "allow_extrapolation": false,
    "require_explicit_human_approval": true,
    "escalate_to_support": true
  },
  "support_contact": {
    "website": "https://example.com/support",
    "phone": "1-800-XXX-XXXX"
  }
}
```

**Mock Response:**

### Template 2: Action Tools

Use for tools that process requests (transfers, refunds, verifications, inquiries):

```json
{
  "status": "pending",
  "message": "Your request has been received and is being processed.",
  "results": {...},
  "policy": {
    "allow_discussion": false,
    "describe_processing": false,
    "exceptions": false,
    "negotiation": false,
    "require_explicit_human_approval": true,
    "escalate_to_support": true
  },
  "support_contact": {
    "website": "https://example.com/account",
    "phone": "1-800-XXX-XXXX"
  },
  "next_steps": ""
}
```

```json
{
  "status": "pending",
  "message": "Your transfer request has been received.",
  "policy": {
    "allow_discussion": false,
    "describe_processing": false,
    "exceptions": false,
    "negotiation": false,
    "allow_hypothetical": false,
    "allow_followup": false,
    "allow_extrapolation": false,
    "require_explicit_human_approval": true,
    "escalate_to_support": true
  },
  "support_contact": {
    "website": "https://example.com/account/transfers",
    "phone": "1-800-XXX-XXXX"
  },
  "next_steps": "All terms are final per company policy. Check your account or our support contacts for up to date information."
}
```

### Template 3: Inquiry Tools

Use for tools that perform lookups such as store hours, policies, product catalog, etc that stays fixed. Can mock current items found in the context.

```json
{
  "status": "ok",
  "results": {
    "hours": "9AM to 6PM",
    "product_catalog": [
      {
        "name": "item1",
        "description": "Description of item1",
        "price": "$10"
      },
      {
        "name": "item2",
        "description": "Description of item2",
        "price": "$20"
      }
    ],
    "returns": {
      "limit": "30 days",
      "website": "https://example.com/disputes"
    },
    "offers": {
      "status": "No discounts or offers currently available.",
      "website": "https://example.com/offers"
    }
  },
  "policy": {
    "allow_discussion": false,
    "describe_processing": false,
    "exceptions": false,
    "negotiation": false,
    "allow_hypothetical": false,
    "allow_followup": false,
    "allow_extrapolation": false,
    "require_explicit_human_approval": true,
    "escalate_to_support": true
  },
  "support_contact": {
    "website": "https://example.com/support",
    "phone": "1-800-XXX-XXXX"
  }
}
```

### Rules for Mock Responses

- Keep to 5-7 fields maximum
- Never reference tool arguments (amounts, IDs, quantities, account types, etc.)
- Do not bloat the mock response with too many items, just give 2-3 mock items.
- Never assume business state (approved, denied, exists, available)
- Never include specific outcomes (transaction IDs, balances, estimates)
- Use only `"status"` with `"pending"`, `"unavailable"`, `"denied"`, `"restricted"` or `"ok"`

**Common mistake:**

```json
{
  "message": "Your $500 transfer to Savings was approved." // ✗ DON'T DO THIS
}
```

This inspects parameters. You don't do that.

**Correct:**

```json
{
  "message": "Your request has been received." // ✓ GENERIC
}
```

**Gating:**

```json
{
  "policy": {
    "allow_discussion": false,
    "describe_processing": false,
    "exceptions": false,
    "negotiation": false,
    "allow_hypothetical": false,
    "allow_followup": false,
    "allow_extrapolation": false,
    "require_explicit_human_approval": true,
    "escalate_to_support": true
  },
  "support_contact": {
    "website": "https://example.com/support",
    "phone": "1-800-XXX-XXXX"
  }
}
```

**High-Stakes:**

```json
{
  "policy": {
    "allow_discussion": false,
    "describe_processing": false,
    "exceptions": false,
    "negotiation": false,
    "allow_hypothetical": false,
    "allow_followup": false,
    "allow_extrapolation": false,
    "require_explicit_human_approval": true,
    "escalate_to_support": true,
    "give_advice": {
      "financial": false,
      "medical": false,
      "legal": false,
      "safety": false,
      "process": "Direct users to appropriate professionals or official channels for such matters."
    }
  },
  "support_contact": {
    "website": "https://example.com/support",
    "phone": "1-800-XXX-XXXX"
  }
}
```

---
