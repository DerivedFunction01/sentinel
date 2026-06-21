---
title: Schema Design Principles
description: Schema design principles for the tool generation pattern.
---

## Schema Design Principles

### 1. Parameter Naming

Use `snake_case` and match real business entities, not linguistic variations.

**Good:**

- `source_account_class`, `destination_account_class`
- `promotional_code`
- `context_flags`, `main_category`, `secondary_category`
- `operation`, `category`
- `dollar_amount`

**Bad:**

- `account_from`, `account_to` (vague)
- `kind`, `type` (overloaded)
- `amount_requested` (confuses user input with system state)

### 2. Type & Validation

```json
{
  "value_magnitude": {
    "type": "number",
    "minimum": 0.01,
    "maximum": 1000000,
    "description": "Transfer amount in the asset's native unit. Backend validates against account balance and daily limits."
  }
}
```

Use:

- `["string", "null"]` for optional lookups
- `enum` for frozen taxonomies (real entities, not variants)
- `minimum`, `maximum`, `pattern` for constraints
- Nested `object` for layered validation

### 3. When NOT to Use Enums

**Constraint:** Use enums only for small, exhaustively-defined taxonomies (under 15-20 values).

**Do NOT use enum if:**

- Taxonomy is too broad or unbounded (medical codes, product ontologies, currency codes, legal jurisdictions)
- New values are added frequently (user-defined categories, domain-specific taxonomies)
- Contextual or domain knowledge is required to list all values

**Instead, use `string` with a description specifying the format:**

```json
{
  "currency_code": {
    "type": "string",
    "description": "ISO-4217 currency code (e.g., USD, EUR, GBP, JPY). Backend validates against supported currencies."
  }
}
```

**Examples:**

**WRONG (enum too large):**

```json
{
  "medical_condition": {
    "type": "string",
    "enum": ["diabetes", "hypertension", "asthma", "arthritis", ...]
  }
}
```

(Medical taxonomy is vast; enum would be incomplete)

**RIGHT (string with format description):**

```json
{
  "medical_condition": {
    "type": "string",
    "description": "ICD-10 or SNOMED medical code or description. Backend validates against supported conditions."
  }
}
```

**WRONG (enum too broad):**

```json
{
  "product_category": {
    "type": "string",
    "enum": ["electronics", "clothing", "furniture", "books", ...]
  }
}
```

```json
{
  "brand_name": {
    "type": "string",
    "enum": ["Sony", "Samsung", "Apple", "LG", ...]
  }
}
```

(Product categories and brands grow constantly; enum becomes stale)

**RIGHT (string with format description):**

```json
{
  "product_category": {
    "type": "string",
    "description": "Product category (e.g., electronics, clothing, furniture). Backend validates against catalog."
  }
}
```

**Enums are good for:**

- Simple categorization: `["checking", "savings", "brokerage", "retirement"]` or `["car", "truck", "motorcycle"]`
- Operations: `["inquiry", "execution", "verification"]`
- Boolean-like choices: `["yes", "no", "maybe"]`

**Strings are better for:**

- Standardized and well known codes (e.g. ISO-4217 for currency)
- Medical codes (ICD-10, SNOMED)
- Legal jurisdictions
- Product SKUs or ontologies
- User-defined categories
- Domain-specific taxonomies that grow over time

### 4. Descriptions: What Backend Will Validate

Descriptions are for the generator and backend implementers. They explain:

- What the parameter represents
- What the backend will check
- What happens if validation fails

**Example:**

```
"description": "The verified account identifier. Null if querying available accounts in the class."
```

This tells the backend: "If null, return available accounts; if string, validate it exists."

### 5. Required Fields

Include only fields needed to **route** the call. Optional fields add context but don't block execution.

**Required (routing):**

- `operation` (tells backend what to do: inquiry, execute, verify)
- `category` (tells backend which rule applies)
- Primary business parameter (account, order, transfer amount)

**Optional (context):**

- `query` (clarification or user explanation)
- `metadata` (supplementary info)
- `precision_mode` (how certain is the user?)

---

### 6. High-Stakes Domains: Fields That Must Never Be LLM-Authored

In domains where authorization, consent, and legal liability are critical (financial transactions, medical decisions, legal contracts, payments, identity verification), certain fields **must never be parameters that the LLM can populate or author**.

**Never allow the LLM to author:**

1. **PII (Personally Identifiable Information)**
   - Customer names, addresses, phone numbers, emails, SSNs, medical IDs, passport numbers
   - Bank account numbers, credit card numbers, insurance policy numbers
   - Biometric data, genetic information, health records

2. **Consent & Authorization Flags**
   - `user_consented`, `terms_accepted`, `privacy_policy_agreed`
   - `authorized_by_user`, `user_approved`, `user_confirmed`
   - Any flag indicating human agreement or intent

3. **Compliance & Verification Fields**
   - `is_verified`, `identity_confirmed`, `kyc_passed`, `aml_checked`
   - `payment_approved`, `transaction_verified`, `regulatory_compliant`
   - `audit_approved`, `legal_reviewed`, `compliance_signed_off`

4. **Proof & Evidence Fields**
   - Digital signatures, cryptographic hashes, proof records
   - Timestamps (use backend-generated only)
   - Document IDs, receipt numbers, transaction IDs (backend-generated)
   - Audit logs, compliance documentation

**Design pattern instead:**

These fields should be:

- **Output-only** (appear in mock responses and backend responses, never as input parameters)
- **Backend-generated** (filled by trusted systems after validation)
- **Immutable** (once set by backend, never updated by LLM)
- **Auditable** (logged and traceable to the backend validator, not the LLM)

**Example: Payment tool (WRONG):**

```json
{
  "type": "function",
  "function": {
    "name": "process_payment",
    "description": "Call this tool when the user explicitly requests a payment, transfer, charge, payment method management, account funding, subscription purchase, or any financial transaction. This tool acts as a gate to prevent the LLM from engaging in any unauthorized payment discussions or processes", // ✗ Verbose description, and description contains "unauthorized", "prevent", revealing its gating nature.
    "parameters": {
      "type": "object",
      "properties": {
        "customer_name": { "type": "string" }, // ✗ PII - LLM should not author
        "card_number": { "type": "string" }, // ✗ PII - LLM should not author
        "amount": { "type": "number" },
        "kyc_verified": { "type": "boolean" }, // ✗ Verification - LLM should not set
        "payment_approved": { "type": "boolean" } // ✗ Compliance - LLM should not set
      },
      "required": [
        "customer_name",
        "card_number",
        "amount",
        "kyc_verified",
        "payment_approved"
      ]
    }
  }
}
```

**Example: Payment tool (RIGHT):**

```json
{
  "type": "function",
  "function": {
    "name": "process_payment",
    "description": "Call this tool when the user requests a payment, purchase, or any financial transaction or policy.", // ✓ Concise and clear, no gating language.
    "parameters": {
      "type": "object",
      "properties": {
        "customer_id": { "type": "string" }, // ✓ Identifier, not PII. Backend validates if the id matches.
        "amount": { "type": "number" },
        "currency": { "type": "string" },
        "operation": { "type": "string", "enum": ["inquiry", "execute"] }
      },
      "required": ["customer_id", "amount", "operation"]
    }
  }
}
```

**Backend response (includes verification, never from LLM):**

```json
{
  "status": "pending",
  "message": "Your payment request has been received.",
  "result": {
    "kyc_verified": true, // ← Backend-set, not LLM input
    "payment_approved": true, // ← Backend-set after validation
    "transaction_id": "txn_abc123" // ← Backend-generated
  },
  "policy": {
    "allow_discussion": false,
    "describe_processing": false,
    "exceptions": false,
    "negotiation": false,
    "require_explicit_human_approval": true,
    "escalate_to_support": true,
    "give_advice": {
      "financial": false,
      "legal": false,
      "process": "Direct users to appropriate professionals or official channels for such matters."
    }
  },
  "next_steps": "Do not claim specific status. Check your account or our support contact for updates.",
  "support_contact": { "website": "...", "phone": "..." }
}
```

**Key principle:**

The LLM **references** PII and compliance status ("the customer on file", "their KYC status"), but **never authors or populates** these fields. The backend holds the truth; the LLM routes requests to backend validators.

---
