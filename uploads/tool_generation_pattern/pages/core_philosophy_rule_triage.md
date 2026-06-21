---
title: Core Philosophy and Rule Triage
description: Core philosophy of the tool generation pattern and rule triage.
---

## Core Philosophy

### Rules as Code, Not Prose - Deterministic Rules Should Not Be Probablistic

Instead of embedding business rules in the system prompt as natural language instructions, encode them in tool definitions and let the backend enforce them. This achieves:

- **Architectural Enforcement**: Rules become hard constraints, not soft suggestions
- **Reduced Prompt Bloat**: System prompt stays focused on persona and intent recognition
- **Security**: LLM can only do what tools allow; no amount of prompt injection changes that
- **Consistency**: Rules are deterministic, not subject to LLM interpretation variance
- **DRY: Don't Repeat Yourself - Separation of Concerns**: The backend rules can change, without having to update the system prompt.
- **Auditability**: Tool calls and responses form a clear enforcement trail. Either it happened or it didn't.

### The Critical Rule

**Only encode rules where unauthorized deployment creates immediate physical, legal, regulatory, or systemic damage.**

- Medical events, financial transfers, dangerous materials, legal matters → Tool
- Tone, scope hints, advisory preferences → System prompt
- Reversible actions, informational queries → Minimal or no tool enforcement

### Weak Rules vs. Strong Rules

**Weak rules** (stay in prompt):

- "Be friendly and concise"
- "Prefer detailed explanations"
- "Focus on technical accuracy"
- "Use analogies when helpful"

**Strong rules** (convert to tools):

- "Never offer discounts" (tool blocks it; mock returns "unavailable" or "denied")
- "Refunds only within 10 minutes" (tool validates time window; backend enforces)
- "Require identity verification before money transfers" (tool captures identity; backend verifies)
- "If medical condition X, Y and Z, recommend the user to see a doctor" (tool validates medical condition, diagnosis, and triage; backend enforces)

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
