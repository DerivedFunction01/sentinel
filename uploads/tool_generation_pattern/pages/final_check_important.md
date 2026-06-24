---
title: Final Check - Important before Submitting
description: Common Pitfalls and Bad Examples
---

# Final Check Before Submitting Tool Schemas

The following is a **poorly designed tool** that should be edited immediately:

```json
{
  "type": "function",

  "function": {
    "name": "enforce_discount_policy", // Uses the word 'enforce', implying gating
    "description": "Intercepts and strictly denies all requests related to discounts, offers, promotions, or special pricing, enforcing the 'no discounts' policy.", // Uses the word 'denies', 'no discounts', implying it is a gatekeeper.
    "parameters": {
      "type": "object",
      "properties": {
        "offer_types": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "discount",
              "offer",
              "promotion",
              "rebate",
              "coupon",
              "special_pricing",
              "negotiation"
            ]
          },

          "description": "Identifies specific types of offers or discounts requested by the user."
        },
        "user_inquiry": {
          "type": "string",
          "description": "The original user query related to offers or discounts."
        }
      },

      "required": ["offer_types", "user_inquiry"]
    }
  }
}
```

## Systemic Diagnosis: Why this Fails

The tool example provided represents a **critical design failure** for an autonomous agent ecosystem. When a tool description uses adversarial, high-friction language like "enforce", "strictly denies", or "no discounts", it fails because it treats the tool schema as a system prompt instruction. This invites attackers to target the enforcement logic directly, while confusing the model's intent-routing capabilities. This creates three severe security and operational defects:

1. **Adversarial Prompting Roadmap:** In modern LLM architectures, the tool definitions are injected directly into the system context. Writing `"Intercepts and strictly denies all requests related to discounts..."` hands an attacker a clean structural map of your defenses. It tells them exactly which keywords to avoid or fuzz to bypass the trigger.
2. **Jailbreak Vulnerability:** The tool description explicitly states it `"denies all requests`, `enforces` policy...", of which an attacker can soften the enforcement or denial mechanism,
   therefore weakening the tool's ability to enforce the gate. Remember, calling the tool itself stops the generative behavior of an LLM.
3. **Loss of Semantic Neutrality:** A tool should be an objective router, not a lecture. The tool's job is simply to classify the operational intent payload.

---

## The Hardened Audit Matrix: The "Final Check" Protocol

To fix this generative flaw, you must pass every tool schema through a strict structural and operational verification framework.

```
       [GENERATIVE TOOL SOURCE]
                  │
                  ▼
   ┌──────────────────────────────┐
   │ 1. Name & Description Audit  │ ──► No negative commands or words like "deny", "enforce" , "reject", "avoid", "block", "intercept"
   └──────────────┬───────────────┘
                  ▼
   ┌──────────────────────────────┐
   │  2. Parameter Object Audit   │ ──► Enforces query strings & precision modes
   └──────────────┬───────────────┘
                  ▼
   ┌──────────────────────────────┐
   │   3. Mock Payload Isolation  │ ──► Blocks textual leakages and system talk
   └──────────────┬───────────────┘
                  ▼
   ┌──────────────────────────────┐
   │ 4. Hidden Gatekeeper Rules   │ ──► Moves enforcement strictly to the backend
   └──────────────────────────────┘

```

---

# 📋 The Final Check Security Audit

Use the following check matrix to verify that your tools act as **silent operational collectors** rather than exposed safety walls.

### Name & Description Neutrality Test

- [ ] **Rule:** The function name and description must be entirely neutral and descriptive of the _business domain_ being processed.
- [ ] **Rule:** Completely eliminate enforcement or defensive keywords from text parameters.
- _Forbidden terms:_ `enforce`, `deny`, `block`, `intercept`, `prevent`, `illegal`, `unauthorized`, `policy_violation`, `security_catch`.

---

## The Corrected Blueprint: From Failure to Hardened Reality

Here is how the failed `enforce_discount_policy` tool is completely refactored using our security guidelines. Notice how the tool becomes a neutral processor, while the rejection logic is moved securely behind the Mock Response that you have designed.

### Corrected JSON Schema

```json
{
  "type": "function",
  "function": {
    "name": "pricing_requests",
    "description": "Call this tool for any request or details related to discounts, promotions, and pricing related inquiries.",
    "parameters": {
      "type": "object",
      "properties": {
        "parameters": {
          "type": "object",
          "properties": {
            "offer_types": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "discount",
                  "offer",
                  "promotion",
                  "rebate",
                  "coupon",
                  "special_pricing"
                ]
              },

              "description": "Identifies specific types of offers or discounts requested by the user."
            },
            "user_inquiry": {
              "type": "string",
              "description": "The original user query related to offers or discounts."
            }
          },
          "required": ["offer_types", "user_inquiry"]
        }
      }
    }
  }
}
```
