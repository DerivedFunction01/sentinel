---
title: Generation Algorithm
description: The algorithm follows these steps to convert a weak prompt into [new prompt + tools + guide]
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

- **Tier 1 (Binary Gate):** Single categorical denial (never offer discounts, API keys)
- **Tier 2 (Categorical + Conditional):** Related operations with conditions (commerce transactions, refunds)
- **Tier 3 (Complex Multi-Stage):** Nested validation, precision modes, state-dependent execution (finance transfers)

**Decision factors:**

- How many conditions apply?
- Does the tool need to handle uncertainty (nullable IDs, precision modes)?
- Does the backend need to validate across multiple fields?
- What should not be encoded in the tool or be model authored (e.g. finance compliance flags, human consent)
- Should I use an Orchestrator, Object Oriented, or CQRS-Evented Tool Pattern if I have too many fields? (See Avoid Tool Bloat)

### Step 5: Design Tool Schema

For each tool:

#### 1. **Name**

1. Snake_case, neutral, specific, but not too long or confusing.
2. Should not be broad that it will cause collisions with other tools or rules in the same domain setting.
3. For example: a broad tool name like `medical_request` is wrong when it only covers diagnosis in a medical setting (collides with treatment, prescription, triage, and advice).
4. Should not encode the binary or gating nature of the tool, such as `prohibit_access`, `permission_denial`, `operations_gate`.
5. Should nt use an overly long tool name, when the description covers its nature, such as `get_category1_category_2_category_3`.
6. Also do not try to collide with already existing tools. If it does, then attempt to merge them together by expanding it as long it doesn't
   make the tool parameters too complicated and verbose.

#### 2. **Description**

1. List explicit triggers; balance between being too specific and too broad. It doesn't not need to include a long list of synonyms.
2. Do not add gating or meta language such as "This tool acts as a gate to prevent the LLM from engaging in any unauthorized ...".
   1. If it exists in the tool's description, it should be removed and updated.

#### 3. **Parameters**

1. **Parameter Names:** operation, category, primary business fields, query, metadata, context, etc
2. **Constraint:** Use enums for frozen taxonomies. If a taxonomy will have too many enums (>15-20) or is hard to define exhaustively, do NOT use enum. For example: Medical taxonomies or contextual flags, product ontologies, currency codes, or legal codes are too broad; use `string` with a description of desired format (ex. 'ISO-4217 currency code such as USD').
   1. **Exception:** Some `meta` level tools will require a list of enums to properly "bait" the LLM to use the tool.
3. Use nullable types for lookups
4. Embed constraints (min, max, pattern)

#### 4. **Validation:**

1. Describe what backend will check

**Example naming convention:**

```md
Target: The model is not allowed to access a database in a SWE setting

Bad:

- `deny_database_access` (explicitly mention the binary nature of the tool in name)
- `database` (this might collide with other tools that need to access database, or is too broad)

Good:

- `database_lookup` (if no other database tool exist)
- Expand the original `database_operation` tool to include an `access` enum.

Target: The model is not allowed to give investment advice in a bank setting

Bad:

- `investment_operation` with generic `query` parameter (this might collide with banking investment functions and tools, such as research and porfolio analytics)
- `investment_advisor_role_restriction` (explicitly mention the binary nature of the tool in name)

Good:

- `investment_advice` (scoped to this bank's regulations for giving investment advice)
- `investment_operation` with category enums of `advice`, `research`, `analytics`, `order`, etc.
```

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

Create a generic, parameter-agnostic mock using the appropriate template, being sure to replace the example links and phone if they already exist in the context:

**For gates (Tier 1) Example, ABC Retail:**

```json
{
  "status": "denied",
  "policy": {...}, // See Mock Response Strategy
  "support_contact": {
    "website": "https://abc-retail.com/support",
    "phone": "1-800-ABC-5678" // If given in context
  }
}
```

**For actions (Tier 2 & 3) Example, ABC Retail:**

```json
{
  "status": "pending",
  "message": "Your request has been received.",
  "results": {...}, // See Mock Response Strategy
  "policy": {...}, // See Mock Response Strategy
  "support_contact": {
    "website": "https://abc-retail.com/support",
    "phone": "1-800-ABC-5678" // If given in context
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
