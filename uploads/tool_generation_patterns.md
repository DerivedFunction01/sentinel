# Tool Generation Patterns: From Weak Prompts to Tools + Rationale

## Table of Contents

1. [Purpose & Overview](#purpose--overview)
2. [Core Philosophy](#core-philosophy)
3. [Rule Triage: What Gets a Tool](#rule-triage-what-gets-a-tool)
4. [Tool Complexity Tiers](#tool-complexity-tiers)
5. [Universal Tool Protocols](#universal-tool-protocols)
6. [Schema Design Principles](#schema-design-principles)
7. [Mock Response Strategy](#mock-response-strategy)
8. [Intent Recognition & Precision Encoding](#intent-recognition--precision-encoding)
9. [Generation Algorithm](#generation-algorithm)
10. [Output Format: Prompt + Tools + Guide](#output-format-prompt--tools--guide)
11. [Examples: Simple to Complex](#examples-simple-to-complex)

---

## Purpose & Overview

This guide teaches the **generator** (an LLM tasked with converting weak system prompts) how to:

1. **Identify weak rules** in existing prompts (prose-based constraints that belong in tools)
2. **Extract enforcement logic** and encode it in tool schemas
3. **Design mock responses** that document enforcement boundaries
4. **Generate outputs** in three pieces:
   - **New Prompt**: Revised system prompt with weak rules removed/converted
   - **Tools**: Complete tool definitions (JSON schemas with backend rules)
   - **Guide/Rationale**: User-facing documentation explaining why rules moved and what enforcement looks like

The generator outputs these three components so a human can understand, validate, and implement the transformation.

---

## Core Philosophy

### Rules as Code, Not Prose

Instead of embedding business rules in the system prompt as natural language instructions, encode them in tool definitions and let the backend enforce them. This achieves:

- **Architectural Enforcement**: Rules become hard constraints, not soft suggestions
- **Reduced Prompt Bloat**: System prompt stays focused on persona and intent recognition
- **Security**: LLM can only do what tools allow; no amount of prompt injection changes that
- **Consistency**: Rules are deterministic, not subject to LLM interpretation variance
- **Auditability**: Tool calls and responses form a clear enforcement trail

### The Critical Rule

**Only encode rules where unauthorized deployment creates immediate physical, legal, or systemic damage.**

- Medical dosing, financial transfers, dangerous materials → Tool
- Tone, scope hints, advisory preferences → System prompt
- Reversible actions, informational queries → Minimal or no tool enforcement

### Weak Rules vs. Strong Rules

**Weak rules** (stay in prompt):

- "Be friendly and concise"
- "Prefer detailed explanations"
- "Focus on technical accuracy"
- "Use analogies when helpful"

**Strong rules** (convert to tools):

- "Never offer discounts" (tool blocks it; mock returns "unavailable")
- "Refunds only within 10 minutes" (tool validates time window; backend enforces)
- "Require identity verification before transfers" (tool captures identity; backend verifies)

---

## Rule Triage: What Gets a Tool

### Categories That Get Tools

| Category                  | Examples                                                                | Risk Level |
| ------------------------- | ----------------------------------------------------------------------- | ---------- |
| **Physical Harm**         | Medical dosing, chemical transfers, dangerous operations                | Critical   |
| **Legal Liability**       | Privacy violations, fraud, unauthorized access, litigation risk         | Critical   |
| **Systemic Damage**       | Authentication bypass, data exfiltration, privilege escalation          | Critical   |
| **Irreversible Actions**  | Deletions, transfers, account closures, public statements               | High       |
| **Conditional Execution** | Actions that require verification (identity, account existence, limits) | High       |

### Categories That DON'T Get Tools

- Tone preferences ("be friendly, concise")
- Quality guidelines ("be detailed, thoughtful")
- Scope limitations ("only discuss X topic")
- Content style ("use analogies, examples")
- Minor policy variations ("prefer A over B")

These live in the new system prompt as guidance, not enforcement.

### Scope Compression: Combine vs. Split

**Combine rules into one tool** when they are semantically related and share enforcement logic:

- "No discounts" + "No refunds" → Both transaction denials; combine into `commerce_transactions`
  - **Rationale**: Both blocked at the same layer; backend handles them identically
  - **Context**: Business offers neither discounts nor refunds; both go to support

- "No API key exposure" + "No credential sharing" → Both security denials; combine into `credential_operations`
  - **Rationale**: Both prevent unauthorized access; mock returns "unavailable"

**Split rules into separate tools** when they belong to different domains or have different validation logic:

- "No financial transfers" + "No medical advice" → Combine? No. Split into `finance_transfer` + `medical_advice`
  - **Rationale**: Different domains (finance vs. medical); different backend enforcement
  - **Context**: One is a business policy; one is a safety gate

- "No refunds" + "Refund eligibility check" → Combine? Yes.
  - **Rationale**: Refund is a conditional action. Combine it into a single tool with three operation modes: inquiry, verification, and execution.
  - **Context**: Business denies some refunds but accepts others based on conditions.

**When unclear:** Ask—Does the backend handle them identically, or do they require different validation paths? If identical, combine. If different, split.

---

## Tool Complexity Tiers

### Tier 1: Binary Gate (No Parameters or Minimal)

**Use when:** A single categorical denial applies to multiple unrelated prohibited actions.

**Characteristics:**

- No required parameters, or minimal (`query` only)
- Single enum for category of denial
- Mock response is always "unavailable"
- Tool name and description are neutral, never reveal gating
- For: discounts, API keys, internal processes

**Example:**

```json
{
  "type": "function",
  "function": {
    "name": "gated_operations",
    "description": "Call for inquiries about discounts, promotional codes, API credentials, internal system details.",
    "parameters": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "enum": [
            "discounts",
            "promotions",
            "api_credentials",
            "internal_processes"
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

**Mock Response:**

```json
{
  "status": "unavailable",
  "message": "This service is not available. Contact support for more information.",
  "support_contact": {
    "website": "https://example.com/support",
    "phone": "1-800-EXA-MPLE"
  }
}
```

---

### Tier 2: Categorical + Conditional

**Use when:** Related business operations with conditions, boundaries, or role-based access.

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
    "description": "Call for discount codes, rebates, offers, promotions, loyalty program inquiries, loyalty point adjustments, payment processing, and refund policies.",
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

**Mock Response:**

```json
{
  "general_information": {
    "hours": "Mon–Fri 9–5 EST",
    "location": "Online only",
    "refunds_and_disputes": "https://www.example-retail.com/refunds_and_disputes",
    "offers_and_discounts": "No discounts, promotions, or special offers are available at this time.",
    "membership_and_loyalty": "Customers can enroll in our membership program to earn points on purchases.",
    "website_for_more_information": "https://www.example-retail.com/offers_and_membership"
  }
}
```

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

**Example: Finance Transfer (Universal Protocol)**

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
  "message": "Your transfer request has been received and is being processed.",
  "next_steps": "Check your account dashboard for updates or contact support.",
  "support_contact": {
    "website": "https://example.com/account/transfers",
    "phone": "1-800-XXX-XXXX"
  }
}
```

---

## Universal Tool Protocols

Some tool examples (like `finance_transfer`) are marked as **[UNIVERSAL PROTOCOL]** and represent **maximal-yet-minimal** design patterns.

### What This Means

A universal protocol tool:

- Encodes all the uncertainty a real system needs to handle (nullable IDs, nested validation, precision modes)
- Avoids hardcoding business-specific constraints (no domain-specific limits, no edge cases, no jurisdiction-specific compliance checks)
- Remains timeless and domain-agnostic; simple businesses strip it down, complex ones extend it

### Example: Finance Transfer

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

## Schema Design Principles

### 1. Parameter Naming

Use `snake_case` and match real business entities, not linguistic variations.

**Good:**

- `source_account_class`, `destination_account_class`
- `operation`, `category`
- `value_magnitude`

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

### 3. Descriptions: What Backend Will Validate

Descriptions are for the generator and backend implementers. They explain:

- What the parameter represents
- What the backend will check
- What happens if validation fails

**Example:**

```
"description": "The verified account identifier. Null if querying available accounts in the class."
```

This tells the backend: "If null, return available accounts; if string, validate it exists."

### 4. Required Fields

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

## Mock Response Strategy

### The Pipeline Constraint

**The pipeline returns the same mock response for every tool call, regardless of parameters.**

This means:

- No JSON argument parsing (except validation)
- No conditional logic based on parameters
- No state lookups or assumptions

### Mock Response Design

Mock responses **must be generic and parameter-agnostic**:

- **Status:** Default to `"pending"` (for actions), `"ok"` (for informational queries), or `"unavailable"` (for gates)
- **Message:** Parameter-agnostic explanation
- **Next Steps:** Real endpoints (website, support) where actual status lives
- **Guidance:** What happens next without claiming outcomes

### Template 1: Gate Tools

Use for tools that block access entirely (discounts, API keys, internal processes):

```json
{
  "status": "unavailable",
  "message": "This service is not available.",
  "support_contact": {
    "website": "https://example.com/support",
    "phone": "1-800-XXX-XXXX"
  }
}
```

### Template 2: Action Tools

Use for tools that process requests (transfers, refunds, verifications, inquiries):

```json
{
  "status": "pending",
  "message": "Your request has been received and is being processed.",
  "next_steps": "Check your account for updates or contact support.",
  "support_contact": {
    "website": "https://example.com/account",
    "phone": "1-800-XXX-XXXX"
  }
}
```

### Template 3: Inquiry Tools

Use for tools that perform lookups such as store hours, policies, product catalog, etc that stays fixed.

```json
{
  "status": "ok",
  "results": {
    "hours": "9AM to 6PM",
    "policy": "Return policy: within 30 days. Contact support to initiate a return, or visit the website for detailed information and status.",
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
    ]
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
- Use only `"status"` with `"pending"`, `"unavailable"`, or `"ok"`

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
  "message": "Your request has been received and is being processed." // ✓ GENERIC
}
```

---

## Intent Recognition & Precision Encoding

### Why Intent Matters

The generator must teach the LLM to recognize user intent because tools encode **execution modes**, not just **blocking logic**.

**Example:**

User says: "I want to transfer $500" (definitive)
→ `precision_mode: "strict_execute"` → Backend executes if conditions met

User says: "Should I transfer $500?" (hedged)
→ `precision_mode: "strict_clarify"` → Backend requests confirmation

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

```
WHEN TO CALL `finance_transfer`:

- User says "I want to transfer $500" → call with precision_mode: "strict_execute"
- User says "Should I transfer $500?" → call with precision_mode: "strict_clarify"
- User says "Transfer $500 if possible" → call with precision_mode: "best_effort"

WHEN NOT TO CALL:

- If user is asking about transfer policies, use commerce_transactions with operation: "inquiry"
```

---

## Generation Algorithm

The generator follows these steps to convert a weak prompt into [new prompt + tools + guide]:

### Step 1: Audit the Weak Prompt

Read the existing system prompt and identify all business rules, constraints, and denials.

**Categorize each rule:**

- Weak prose (stays in new prompt)
- Strong enforcement (becomes a tool)
- Hybrid (enforcement tool + guidance in prompt)

**Document your reasoning** as you go; this feeds the guide/rationale later.

### Step 2: Triage Rules for Tools

For each strong rule, ask:

- **Does this create physical, legal, or systemic damage if violated?**
  - Yes → Tool (critical)
  - Borderline → Tool (high-risk irreversible action)
  - No → Stays in prompt

**Example:**

- "Never offer discounts" → Tool (business policy; backend enforces)
- "Be friendly and concise" → Prompt (tone; guidance only)
- "Refund only within 10 minutes" → Tool (condition; backend validates)

### Step 3: Group Rules by Domain & Semantics

Combine related rules into one tool using **scope compression**:

- "No discounts" + "No refunds" → `commerce_transactions`
  - Same domain (commerce)
  - Same enforcement (denial or conditional approval)
  - Backend handles identically

- "No API keys" + "No credentials" → `credential_operations`
  - Same domain (security)
  - Same enforcement (block access)
  - Different from commerce, so separate

### Step 4: Determine Tool Complexity Tier

For each tool, decide:

- **Tier 1 (Binary Gate):** Single categorical denial (discounts, API keys)
- **Tier 2 (Categorical + Conditional):** Related operations with conditions (commerce transactions, refunds)
- **Tier 3 (Complex Multi-Stage):** Nested validation, precision modes, state-dependent execution (finance transfers)

**Decision factors:**

- How many conditions apply?
- Does the tool need to handle uncertainty (nullable IDs, precision modes)?
- Does the backend need to validate across multiple fields?
- What should not be encoded in the tool or be model authored (e.g. finance compliance flags, human consent)

### Step 5: Design Tool Schema

For each tool:

1. **Name:** Snake_case, neutral (not "block_requests"; use something like "gated_operations")
2. **Description:** List explicit triggers; be exhaustively specific
3. **Parameters:**
   - Required: operation, category, primary business fields
   - Optional: query, metadata, context
   - Use enums for frozen taxonomies
   - Use nullable types for lookups
   - Embed constraints (min, max, pattern)
4. **Validation:** Describe what backend will check

**Example description formula:**

```
"Call for [explicit triggers separated by commas]. Includes [outcomes or domains]."
```

Good:

- "Call for discount codes, rebates, offers, promotions, loyalty program inquiries, and payment processing."
- "Call when user expresses intent to move money, allocate assets, or settle balances between account types."

Bad:

- "Handles user requests" (vague)
- "Denies unauthorized access" (reveals the gate)
- "Processes transactions" (too broad)

### Step 6: Design Mock Response

Create a generic, parameter-agnostic mock using the appropriate template:

**For gates (Tier 1):**

```json
{
  "status": "unavailable",
  "message": "This service is not available.",
  "support_contact": {
    "website": "https://example.com/support",
    "phone": "1-800-XXX-XXXX"
  }
}
```

**For actions (Tier 2 & 3):**

```json
{
  "status": "pending",
  "message": "Your request has been received and is being processed.",
  "next_steps": "Check your account for updates or contact support.",
  "support_contact": {
    "website": "https://example.com/account",
    "phone": "1-800-XXX-XXXX"
  }
}
```

**Rules:**

- No parameter inspection or conditional logic
- No specific outcomes or claims
- Links to real endpoints where actual status lives

### Step 7: Document Backend Validation Rules

Create a comment block for each tool listing all if-then conditions:

```
BACKEND VALIDATION RULES [tool_name]:
- if source_id is null → query available accounts
- if allocation_type is "percentage" → validate 0-100
- if precision_mode is "strict_clarify" → request confirmation
- if value_magnitude exceeds daily_limit → deny with available_today
- if location is not "in_store" → deny with "refunds available in-store only"
```

This tells the backend what to enforce and gives the backend engineer clear logic.

### Step 8: Encode Intent Recognition

For tools with execution modes (Tier 2 & 3), identify how the LLM should recognize intent:

**Definitive language** → `precision_mode: "strict_execute"`
**Hedged language** → `precision_mode: "strict_clarify"`
**Tentative language** → `precision_mode: "best_effort"`

Document this in the guide/rationale so the new prompt can teach it.

### Step 9: Create the New Prompt

Remove weak rules that became tools. Keep:

- Tone and persona guidance
- Scope and topic boundaries
- General behavioral guidance
- Instruction to use the new tools

**Example:**

```
Old rule (removed): "Never offer discounts or refunds."

New prompt guidance:
"Use commerce_transactions tool for discount, refund, and payment inquiries.
The tool defines what's available; follow its guidance."

(The new prompt still has tools list appended, or referenced separately)
```

### Step 10: Create the Guide/Rationale

For each rule that became a tool, explain:

1. **What changed:** "This rule moved from prose to a tool"
2. **Why:** "The rule is critical; enforcement must be hard"
3. **How it works:** "The user can't invent discounts because the tool blocks it"
4. **Mock demonstrates:** "The mock response shows what the user sees—status 'unavailable' with a support link"

**Example format:**

```markdown
### Rule: "Never offer discounts or refunds"

**Old approach (weak):**
The prompt stated: "Do not offer discounts or refunds."

**New approach (tool):**
This rule is now a tool: `commerce_transactions`

**Why the change:**

- Discounts/refunds are critical business policies
- A prose rule is too easy to circumvent
- Tool enforcement is deterministic and auditable

**How it works:**

- User asks: "Can I get a discount?"
- You call: `commerce_transactions` with operation="inquiry", category="discount"
- Backend returns: { "status": "unavailable", "message": "...", "support_contact": {...} }
- Result: You can't invent discounts; the tool enforces the boundary

**What the user sees:**
The mock response tells users to contact support for discounts—no false promises.

**Examples:**

- User: "Is there a discount code?" → Call commerce_transactions
- User: "Can I refund this?" → Call commerce_transactions with category="refund"
- User: "What if I provide proof?" → Still call commerce_transactions (tool handles it)
```

### Step 11: Validate Coverage

Check:

- ✓ All critical rules are in tools
- ✓ Weak rules are in the new prompt
- ✓ No overlapping tools (scope compression applied correctly)
- ✓ Each tool has clear triggers (tool descriptions are specific)
- ✓ Mock responses are parameter-agnostic and generic
- ✓ Backend validation rules are exhaustive and unambiguous

If any check fails, revise the tool definitions.

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

## Examples: Simple to Complex

### Example 1: Tier 1 - Simple Gate

**Original weak rule:**

```
"Never discuss pricing discounts, promotional codes, or special offers."
```

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
  "message": "Pricing inquiries are handled by our sales team.",
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
  "next_steps": "You can check the status of your request in your account or contact support for updates.",
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

```markdown
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

```
"Users can transfer money between their accounts. Require verification.
Respect daily transfer limits. Support multiple account types.
Honor user intent: if hedged, confirm first; if definitive, execute if eligible."
```

**Tool Definition:**
[See full Tier 3 example in previous section]

**Guide/Rationale:**

```markdown
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
A simple business uses only required fields; a complex one adds rebalance_enabled and tax_aware.
The enforcement model doesn't change; only scope.

### Intent Recognition
- "I want to..." or "Transfer..." → precision_mode="strict_execute"
- "Can I..." or "Could I..." → precision_mode="strict_clarify"
- "Transfer if possible" → precision_mode="best_effort"
```

---

## Summary: Key Principles

1. **Rules as Code:** Encode enforcement in tools; keep guidance in prompt
2. **Pareto Triage:** Only tool-ify critical, irreversible, or legally binding rules
3. **Scope Compression:** Combine related rules (same domain, same backend logic); split different domains
4. **Tier Selection:** Match tool complexity to validation complexity (binary gate, conditional, multi-stage)
5. **Universal Protocols:** Some tools are maximal-yet-minimal; simple businesses use fewer fields; complex ones use more
6. **Neutral Naming:** Tool names don't reveal gating ("gated_operations" not "deny_discounts")
7. **Minimal Required Fields:** Route with operation + category; optional fields add context
8. **Frozen Taxonomies:** Enums reflect real entities, not linguistic variants
9. **If-Thens in Schema:** Constraints and precision modes encode backend logic
10. **Intent Recognition:** Teach the LLM to map user language (definitive vs. hedged) to execution modes
11. **Generic Mock Responses:** Never assume business state; parameter-agnostic; link to real endpoints
12. **Three Outputs:** Generator produces [new prompt + tools + guide/rationale] as a coherent package
13. **Auditability:** Tool calls and backend rules form a clear trail of what was enforced and why

---

## Generator Workflow (Quick Reference)

1. **Audit** the weak prompt; categorize rules (weak prose vs. strong enforcement)
2. **Triage** each rule (critical? → tool; guidance? → prompt)
3. **Group** related rules by domain (scope compression)
4. **Tier** each tool (binary gate, conditional, complex)
5. **Design** tool schema (parameters, enums, validation, descriptions)
6. **Mock** the response (generic, parameter-agnostic, links to real endpoints)
7. **Document** backend validation rules (if-then, exhaustive)
8. **Encode** intent recognition (definitive, hedged, tentative language)
9. **Revise** the system prompt (remove weak rules; add tool guidance)
10. **Create** the guide/rationale (why, how, examples)
11. **Validate** coverage (all critical rules tooled? No overlaps? Clear triggers?)
12. **Output** three components: [new prompt, tools, guide]
