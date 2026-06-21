---
title: Universal Tool Protocols
description: Universal tool protocols for the tool generation pattern.
---

## Universal Tool Protocols

Some tool examples (like `finance_transfer`) are marked as **[UNIVERSAL PROTOCOL]** and represent **maximal-yet-minimal** design patterns.

### What This Means

A universal protocol tool:

- Encodes all the uncertainty a real system needs to handle (nullable IDs, nested validation, precision modes)
- Avoids hardcoding business-specific constraints (no domain-specific limits, no edge cases, no jurisdiction-specific compliance checks)
- Remains timeless and domain-agnostic; simple businesses strip it down, complex ones extend it

### Example: Finance Transfer

```json
{
  "type": "function",
  "function": {
    "name": "finance_transfer",
    "description": "Execute fund transfers between verified accounts. Call when user expresses intent to move money, allocate assets, or settle balances between account types.",
    "parameters": {
      "type": "object",
      "properties": {
        "operation": {
          "type": "string",
          "enum": ["transfer", "inquiry"],
          "description": "transfer: execute the transfer; inquiry: query available accounts and balances"
        },
        "source_account_class": {
          "type": "string",
          "enum": [
            "checking",
            "savings",
            "brokerage",
            "retirement",
            "credit",
            "custodial_ledger"
          ],
          "description": "The originating account classification."
        },
        "source_id": {
          "type": ["string", "null"],
          "description": "The verified account identifier. Null if querying available accounts in the class."
        },
        "destination_account_class": {
          "type": "string",
          "enum": [
            "checking",
            "savings",
            "brokerage",
            "retirement",
            "external_recipient",
            "decentralized_ledger"
          ],
          "description": "The target account classification."
        },
        "destination_id": {
          "type": ["string", "null"],
          "description": "The target account identifier or routing code. Backend verifies routing eligibility."
        },
        "value_magnitude": {
          "type": "number",
          "minimum": 0.01,
          "maximum": 1000000,
          "description": "Transfer amount in the asset's native unit. Backend validates against account balance and daily limits."
        },
        "asset_class": {
          "type": "string",
          "description": "The asset class being transferred, such as USD, BTC, JPY."
        },
        "precision_mode": {
          "type": "string",
          "enum": ["strict_execute", "strict_clarify", "best_effort"],
          "description": "strict_execute: user is definitive, execute if conditions met; strict_clarify: user is hedged, request confirmation; best_effort: execute with fallback."
        }
      },
      "required": [
        "operation",
        "source_account_class",
        "destination_account_class",
        "value_magnitude",
        "asset_class"
      ]
    }
  }
}
```

**Mock Response:**

```json
{
  "status": "pending",
  "message": "Your transfer request has been received.",
  "policy": {
    "allow_discussion": false,
    "describe_processing": false,
    "exceptions": false,
    "negotiation": false,
    "require_explicit_human_approval": true,
    "escalate_to_support": true,
    "status": "All terms are final per company policy. Check your account or our support contacts for up to date information."
  },
  "support_contact": {
    "website": "https://example.com/account/transfers",
    "phone": "1-800-XXX-XXXX"
  }
}
```

A simple business might use only 3 fields:

```json
{
  "source_account": "savings",
  "destination_account": "checking",
  "amount": 500
}
```

A complex business with compliance requirements might use all fields.

**The pattern is the same; the scope changes.**

### Example 2: Medical Prescription Fulfillment

```json
{
  "type": "function",
  "function": {
    "name": "medical_fulfillment",
    "description": "Initiates a prescription request or refill action for pre-certified medical assets.",
    "parameters": {
      "type": "object",
      "properties": {
        "medication_target": {
          "type": "object",
          "properties": {
            "label": {
              "type": "object",
              "description": "Label of the medication.",
              "properties": {
                "name": {
                  "type": "string",
                  "description": "The brand name or conversational descriptor."
                },
                "standard": {
                  "type": "string",
                  "description": "The standard used if applicable, such as RxNorm, ANDA.",
                  "default": "none"
                },
                "code": {
                  "type": ["string", "number", "null"],
                  "description": "The code from the standard, such as 203080 for Tylenol"
                }
              },
              "required": ["name", "standard"]
            },
            "prescription_id": {
              "type": ["string", "null"],
              "description": "The verified infrastructure token pointing to an active, pre-existing medical chart record."
            }
          },
          "required": ["label", "prescription_id"]
        },
        "quantity_assertion": {
          "type": "object",
          "properties": {
            "quantity_type": {
              "type": "string",
              "enum": [
                "standard_refill",
                "explicit_count",
                "remaining_allocation"
              ]
            },
            "explicit_unit_count": {
              "type": ["integer", "null"],
              "minimum": 1
            }
          },
          "required": ["quantity_type"]
        }
      },
      "required": ["medication_target", "quantity_assertion"]
    }
  }
}
```

### How to Use This Guide

If a universal protocol tool is too complex for your use case:

1. Remove optional fields you don't need
2. Simplify enums to match your business entities
3. Keep the structure and validation logic intact

If it's too simple:

1. Add nested objects for your domain constraints
2. Extend enums with your specific categories
3. Update mock response to reflect your enforcement model

---
