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
- Remains timeless and domain-agnostic; simple businesses strip it down, complex ones extend it. Works in the past, now, and in the future, whether
  it is in the US, China, the EU, or in the Global South.

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
    "allow_hypothetical": false,
    "allow_followup": false,
    "allow_extrapolation": false,
    "require_explicit_human_approval": true,
    "escalate_to_support": true,
    "advice": {
      "financial": false,
      "legal": false,
      "process": "Direct users to appropriate professionals or official channels for such matters."
    },
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
    "description": "Call this tool to execute, verify, or query the clinical fulfillment, dispensing, or distribution of medications, medical supplies, and devices.",
    "parameters": {
      "type": "object",
      "properties": {
        "operation": {
          "type": "string",
          "enum": ["query_stock", "verify_order", "execute_dispense"],
          "description": "The fulfillment stage. query_stock: Check inventory; verify_order: Validate clinical safety boundaries; execute_dispense: Finalize physical/digital fulfillment transaction."
        },
        "fulfillment_item": {
          "type": "object",
          "description": "The canonical concept defining the item to be fulfilled.",
          "properties": {
            "system_type": {
              "type": "string",
              "enum": ["PUBLIC", "CUSTOM"],
              "description": "PUBLIC for international standards (RxNorm for drugs, SNOMED for devices/supplies). CUSTOM for proprietary internal SKUs or warehouse item codes."
            },
            "system_identifier": {
              "type": "string",
              "description": "Exact vocabulary label. Use 'RxNorm', 'SNOMED-CT', 'LOINC', or an internal string like 'WAREHOUSE_CENTRAL_V2'."
            },
            "code": {
              "type": ["string", "null"],
              "description": "The explicit terminology or SKU code. Null if unknown; the backend will perform semantic matching on the display string."
            },
            "display": {
              "type": "string",
              "description": "The explicit text representation of the item (e.g., 'Amoxicillin 500mg capsule', 'Sterile Gauze 4x4')."
            }
          },
          "required": ["system_type", "system_identifier", "display"]
        },
        "quantity": {
          "type": "number",
          "minimum": 1,
          "description": "The exact quantity or count of items requested for fulfillment."
        },
        "precision_mode": {
          "type": "string",
          "enum": ["strict_execute", "strict_clarify", "best_effort"],
          "description": "Captures user certainty. Use strict_execute for definitive 'dispense/ship' commands, strict_clarify for 'Can I fulfill this?' inquiries."
        }
      },
      "required": [
        "operation",
        "fulfillment_item",
        "quantity",
        "precision_mode"
      ]
    }
  }
}
```

### Universal Concepts: The Canonical Concept codes

```json
{
  "concept": {
    "type": "object",
    "description": "Unified concept representation supporting both public standards (SNOMED, UCUM, RxNorm, NSN, NYSE) and fallback internal custom codes.",
    "properties": {
      "system_type": {
        "type": "string",
        "enum": ["PUBLIC", "CUSTOM"],
        "description": "Discriminator indicating whether the system code originates from a public terminology library or an internal proprietary database."
      },
      "system_identifier": {
        "type": "string",
        "description": "The specific vocabulary name. If system_type is PUBLIC, use exact strings: 'SNOMED-CT', 'RxNorm', 'LOINC', 'ICD-10-CM', 'UCUM', 'DICOM'. If CUSTOM, provide the internal system identifier (e.g., 'INTERNAL_BILLING', 'LEGACY_EMR')."
      },
      "code": {
        "type": ["string", "null"],
        "description": "The exact alphanumeric code value (e.g., '254837009', 'I10', '883-9'). Set to null if the exact code is unknown and only the text display is available; the backend will attempt a lexical lookup."
      },
      "display": {
        "type": "string",
        "description": "The human-readable canonical term or description corresponding to the concept (e.g., 'Malignant neoplasm of breast', 'Blood pressure', 'Amoxicillin 500mg capsule'). REQUIRED as a semantic anchor."
      }
    },
    "required": ["system_type", "system_identifier", "display"]
  }
}
```

The `concept` object is not just a metadata dictionary. It is a deterministic semantic router. It bridges the gap between the open-ended, probabilistic way a user talks and the strict, immutable code structures a backend requires. However, this is not required for widely known concepts,
such as currency codes or language codes given a single example.

For example, in `Example 2: Medical Prescription Fulfillment`, the `fulfillment_item` parameter uses a `concept` object to define the item to be fulfilled. In `Example 1: Financal Transfer`, the `asset_class` does not use `concept` to define the asset class. This is because currency codes are widely known with one example, such as `USD`. Avoid bloating parameters with `concept` object for widely known concepts.

### Example 3: Medical Analysis

```json
{
  "type": "function",
  "function": {
    "name": "medical_analysis",
    "description": "Call this tool to submit structured intents for diagnostic interpretation, test result analysis, differential diagnosis synthesis, and clinical routing. Do not output absolute clinical diagnoses in prose.",
    "parameters": {
      "type": "object",
      "properties": {
        "operation": {
          "type": "string",
          "enum": [
            "evaluate_differential",
            "interpret_diagnostic_test",
            "classify_urgency_and_routing"
          ],
          "description": "The specific evaluation vector requested for the engine pipeline."
        },
        "target_clinical_concepts": {
          "type": "array",
          "description": "The primary clinical conditions or test structures currently under active analysis.",
          "items": {
            "$ref": "#/$defs/concept"
          }
        },
        "evidence_assertions": {
          "type": "object",
          "description": "The formalized evidence block anchoring this analysis intent.",
          "required": ["supporting_findings", "pertinent_negatives"],
          "additionalProperties": false,
          "properties": {
            "supporting_findings": {
              "type": "array",
              "description": "Standardized clinical concepts representing present signs, symptoms, lab values, or comorbidities justifying this path.",
              "items": {
                "$ref": "#/$defs/concept"
              }
            },
            "pertinent_negatives": {
              "type": "array",
              "description": "Standardized clinical concepts representing verified absent findings used to rule out alternative differential tracks.",
              "items": {
                "$ref": "#/$defs/concept"
              }
            }
          }
        },
        "precision_mode": {
          "type": "string",
          "enum": ["strict_execute", "strict_clarify"],
          "description": "strict_execute: Definitive clinical submission or diagnostic calculation request. strict_clarify: Exploratory or hypothetical analysis based on tentative/hedged user text."
        }
      },
      "required": [
        "operation",
        "target_clinical_concepts",
        "evidence_assertions",
        "precision_mode"
      ]
    },
    "$defs": {
      "concept": {
        "type": "object",
        "description": "Unified clinical concept representation supporting both public standards and fallback custom facility definitions.",
        "required": ["system_type", "system_identifier", "display"],
        "additionalProperties": false,
        "properties": {
          "system_type": {
            "type": "string",
            "enum": ["PUBLIC", "CUSTOM"],
            "description": "Discriminator separating public terminology libraries from internal proprietary mappings."
          },
          "system_identifier": {
            "type": "string",
            "description": "The explicit vocabulary code library name (e.g., 'SNOMED-CT', 'LOINC', 'RxNorm', 'FACILITY_INTERNAL_V2')."
          },
          "code": {
            "type": ["string", "null"],
            "description": "The explicit alphanumeric code string value. Null if the code is unknown; the backend will compute a lexical lookup using the display string."
          },
          "display": {
            "type": "string",
            "description": "The human-readable canonical term corresponding to the concept (e.g., 'Dyspnea', 'Troponin I panel'). REQUIRED as a semantic anchor."
          }
        }
      }
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
