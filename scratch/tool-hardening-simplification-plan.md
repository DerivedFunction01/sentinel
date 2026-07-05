# Tool Hardening Simplification Plan - Updated with Routing Table Matrix

## Executive Summary

**Goal:** Reduce tool generation from 4-12 LLM calls (8-15s) to 0-2 LLM calls (~1s) by leveraging 100 pre-seeded examples and template-based mock response generation.

**Key Insight (Updated):** Instead of generating tools first, then hardening - **reverse the order**. Generate the hardened prompt FIRST using the routing table matrix approach. The LLM decides if inspiration examples cover the restriction. If yes, it picks/references them. If no, it uses refusal patterns. Tools become a post-processing step.

---

## Current State Analysis

### Existing Architecture

**Two Hardening Paths:**
1. **`executeMultiStepHardening`** (src/lib/scan-prompts.ts:717-856) - **DEAD CODE** (commented out)
   - Original 2-step: tool delegation + compaction + guardrails
   - Had optimization detection/translation (disabled)
   
2. **`executeMultiStepHardeningFull`** (src/lib/scan-prompts.ts:857-926) - **ACTIVE**
   - Only runs Step 1 (full prompt output)
   - Step 2 (guardrails) is bypassed
   - Always used (no configuration to change this)

### Tool Extraction Sub-Paths (src/lib/tool-extractor.ts)

**Fast Path (Lines 843-963):**
- Triggered when DB contains direct-match tools
- Checks if tools are:
  - **OLD/IDENTICAL** → skip
  - **NEW** → adapt mock response via `selectMockResponseByPolicy()`
  - **EDITED** → falls through to slow path
- Returns `slowPathHit: false`
- **Current coverage:** ~60% of scans

**Slow Path (Lines 965-1159):**
- Triggered when:
  - No direct matches in DB
  - Existing tools were edited
  - Fast path returns empty
- Executes LLM agentic extraction loop (4-12 calls)
- Uses `EXTRACTOR_TOOLS` (markdown reader, schema searcher)
- Returns `slowPathHit: true`
- **Current cost:** $0.02-0.05 per scan, 8-15s

### Seed Extractor (src/lib/seed-extractor.ts)

**Purpose:** Extract structured data from system prompt BEFORE hardening
- Extracts: things (discounts, loyalty, etc.), categories, business features
- Used for: attack generation, tool requirements, ontology loading
- **Timing:** Runs FIRST in pipeline, before any hardening
- **Prompt used:** Original, unsanitized system prompt

**Output (SeedInfo):**
```typescript
{
  things: RestrictionThing[],
  personaDescription: string,
  businessFeatures: string[],
  businessCategories: string[],
  isGenerative: boolean,
  relevantFiles: string[],
  coreSystemPrompt: string
}
```

---

## The New Approach: Hardening First, Tools Later

### Core Insight

**Current flow (problems):**
```
1. Generate tools (expensive - 4-12 LLM calls)
2. Insert tools into hardened prompt
3. Output final prompt

Issues:
- Tools generated BEFORE knowing if they're needed
- LLM extraction loop tries to be creative (slow, expensive)
- Hardened prompt must accommodate tool structure
```

**New flow (solution):**
```
1. Generate hardened prompt FIRST (1 LLM call)
   - LLM sees inspiration examples
   - LLM decides: "Tools cover this" OR "Need refusal"
   - Outputs routing table matrix
   
2. Post-process: Extract tool references from hardened prompt
   - If routing table mentions tools → generate/retrieve them
   - If routing table uses refusals → no tools needed
   
3. Final assembly
   - Combine hardened prompt + tools (if any)
   - Done
```

**Benefits:**
- Single LLM call for hardening (always needed)
- Tools only generated if LLM decides they're needed
- No wasted tool generation for restrictions that need refusals
- LLM uses inspiration examples intelligently (not exhaustively)

---

## The Routing Table Matrix (From step1.md)

### Structure

```markdown
# CRITICAL: STRICT EXECUTION PROTOCOL

The following topics are STRICTLY NON-GENERATIVE. For ALL user input matching 
the intents below (indirect or direct), you must immediately halt regular 
conversational response generation and follow entirely to the corresponding protocol.

### 1. INTENT ROUTING MATRIX

| User Intent / Topic               | Mandatory Target Routing | Routing Type          |
| --------------------------------- | ------------------------ | --------------------- |
| **Investment & Financial Advice** | `protocol_financial`     | Tool Handoff Protocol |
| **Debt & Borrowing**              | `protocol_debt`          | Hardened Refusal      |
| **Topic X**                       | `protocol_x`             | Hardened Refusal      |
| **Topic Y**                       | `protocol_y`             | Hardened Redirect     |

### 2. PROTOCOL EXECUTION MATRIX

| Protocol ID          | Hardened Response Constraints & Execution Blueprint                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `protocol_financial` | **Immediate Tool Handoff:** Halts token generation and calls the `financial_advisor` tool payload. Do not generate financial opinions...                 |
| `protocol_debt`      | I am unable to directly assist with [topic]. Please contact a licensed financial advisor...                                                                |
| `protocol_x`         | I cannot assist with [topic]. [Optional strict redirect to core operations]                                                                               |
| `protocol_y`         | I understand you are concerned about [topic]. There are no such Y available, no negotiations...                                                            |
```

### Two Routing Types

**1. Tool Handoff Protocol:**
- LLM calls tool immediately
- Tool enforces restriction dynamically
- Example: `protocol_financial` → calls `financial_advisor` tool

**2. Hardened Refusal/Redirect:**
- LLM generates refusal directly
- No tool needed
- Example: `protocol_debt` → "I am unable to directly assist..."

### Key Innovation

**The LLM decides the routing type based on:**
1. Available inspiration examples (tools in DB)
2. Nature of restriction (dynamic vs static)
3. Safety requirements (high-risk → tool, low-risk → refusal)

**If tools exist in inspiration examples:**
- LLM references them in routing table
- Marks as "Tool Handoff Protocol"
- Post-processor generates/retrieves actual tool definitions

**If no tools exist:**
- LLM uses "Hardened Refusal" pattern
- No tool generation needed
- Saves time and cost

---

## The New Fast Path Flow

### Phase 1: Seed Extraction (Already Exists)
**File:** `src/lib/seed-extractor.ts:228-409`
**Input:** Original system prompt
**Output:** SeedInfo with things[], categories[], businessFeatures[]

**No changes needed.**

---

### Phase 2: Inspiration Lookup (Already Exists)
**File:** `src/lib/tool-extractor.ts:829-841`
**Query:** `SELECT * FROM toolSchemaExamples WHERE granularity = ? AND tags && ?`
**Returns:** Schema templates, mock patterns, compatibility scores

**No changes needed.**

---

### Phase 3: Hardened Prompt Generation (MODIFIED - 1 LLM Call)

**Current approach:**
- Build tool recommendations first
- Insert tools into prompt
- LLM hardens around tools

**New approach:**
- Give LLM inspiration examples DIRECTLY
- LLM generates routing table matrix
- LLM decides tool vs refusal per restriction
- Output: Hardened prompt with routing table

**LLM Prompt (Updated):**
```
You are an expert security engineer specializing in LLM system prompt hardening.

Your task is to strengthen the target system prompt against adversarial attacks 
using a routing table matrix approach.

{{STEP_1_TEXT}}  // From step1.md (the methodology)

Available Inspiration Examples (Tools that could handle restrictions):
{{INSPIRATION_EXAMPLES_BLOCK}}

Forbidden Task (must NEVER do):
<forbidden_task>
{{FORBIDDEN_TASK}}
</forbidden_task>

Breached Attacks (if any):
{{BREACHED_ATTACKS_LIST}}

Original System Prompt:
<system_prompt>
{{SYSTEM_PROMPT}}
</system_prompt>

INSTRUCTIONS:
1. Analyze each restriction in the forbidden task
2. For each restriction, decide:
   - TOOL HANDOFF: If inspiration examples cover this → reference tool in routing table
   - HARDENED REFUSAL: If no tools available → use refusal pattern
3. Build the Intent Routing Matrix
4. Build the Protocol Execution Matrix
5. Output COMPLETE rewritten system prompt

STRICT OUTPUT FORMAT RULES:
You must output the COMPLETE, FULLY REWRITTEN system prompt.
Put the full new system prompt between <REVISED_SYSTEM_PROMPT> and </REVISED_SYSTEM_PROMPT> tags.
```

**LLM Output:**
```xml
<REVISED_SYSTEM_PROMPT>
# Original system prompt (preserved)

# CRITICAL: STRICT EXECUTION PROTOCOL

### 1. INTENT ROUTING MATRIX

| User Intent / Topic               | Mandatory Target Routing | Routing Type          |
| --------------------------------- | ------------------------ | --------------------- |
| **Discount Requests**             | `protocol_discounts`     | Tool Handoff Protocol |
| **Unauthorized Disclosure**       | `protocol_disclosure`    | Hardened Refusal      |

### 2. PROTOCOL EXECUTION MATRIX

| Protocol ID          | Hardened Response Constraints                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `protocol_discounts` | **Immediate Tool Handoff:** Call the `commerce_transactions` tool with operation="inquiry"...  |
| `protocol_disclosure`| I am unable to assist with disclosing [forbidden content]. This violates system policy...      |

[Rest of original prompt preserved]
</REVISED_SYSTEM_PROMPT>
```

**Key Point:** The LLM does the HARD WORK of deciding what goes where. Tool extraction becomes a simple parsing task.

---

### Phase 4: Tool Reference Extraction (NEW - No LLM)

**Parse the hardened prompt:**
```javascript
function extractToolReferences(hardenedPrompt) {
  const matches = hardenedPrompt.matchAll(/`([^`]+)`/g);
  const toolNames = Array.from(matches).map(m => m[1]);
  
  // Filter to only tool references (not other backticks)
  const tools = toolNames.filter(name => {
    // Check if it's in a "Tool Handoff" context
    const context = getContext(hardenedPrompt, name);
    return context.includes('Tool Handoff') || context.includes('tool payload');
  });
  
  return tools; // ['commerce_transactions', 'financial_advisor']
}
```

**Query DB for each tool:**
```javascript
for (const toolName of tools) {
  const example = await db.toolSchemaExample.findFirst({
    where: { name: toolName }
  });
  
  if (example) {
    // Use existing example directly
    toolDefs.push(example);
  } else {
    // Generate compact version (1 LLM call)
    const compact = await compactFromInspiration(toolName, seedContext);
    toolDefs.push(compact);
  }
}
```

**Speed:** Zero LLM calls if tools exist, 1 LLM call per missing tool

---

### Phase 5: Mock Response Seeding (If Tools Generated)

**Same as before:**
- Select template (Gate/Action/Inquiry)
- 1 LLM call per tool group for slot filling
- Merge with template

**Speed:** 0-1 LLM calls (only if new tools generated)

---

## Complete New Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. SEED EXTRACTION (Already Exists)                         │
│    systemPrompt → extractSeedInfo()                         │
│    Output: things[], categories[], businessFeatures[]       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. INSPIRATION LOOKUP (Already Exists)                      │
│    Query toolSchemaExamples by tags/categories              │
│    Output: 5-10 relevant tool examples                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. HARDENED PROMPT GENERATION (1 LLM Call)                  │
│    Input:                                                   │
│    ├─ Original system prompt                                │
│    ├─ Inspiration examples (tool schemas + mocks)           │
│    ├─ Forbidden task                                        │
│    └─ Breached attacks                                      │
│                                                             │
│    LLM Output:                                              │
│    ├─ Complete rewritten system prompt                      │
│    ├─ Intent Routing Matrix (table)                         │
│    ├─ Protocol Execution Matrix (table)                     │
│    └─ Tool references (which tools to use)                  │
│                                                             │
│    KEY DECISION: LLM chooses per restriction:               │
│    ├─ "Tools cover this" → Tool Handoff Protocol            │
│    └─ "No tools available" → Hardened Refusal               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. TOOL REFERENCE EXTRACTION (No LLM)                       │
│    Parse hardened prompt for tool names                     │
│    Extract all `tool_name` references                       │
│    Output: List of referenced tool names                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. TOOL RETRIEVAL/GENERATION (0-1 LLM Calls)                │
│    For each referenced tool:                                │
│    ├─ Check DB → exists? → Use directly (0 LLM calls)      │
│    └─ Not in DB? → Compact from inspiration (1 LLM call)    │
│                                                             │
│    Output: ToolDef[] with mock responses                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. FINAL ASSEMBLY                                           │
│    Combine:                                                 │
│    ├─ Hardened prompt (from Phase 3)                        │
│    └─ Tool definitions (from Phase 5)                       │
│                                                             │
│    Store in DB + return to user                             │
└─────────────────────────────────────────────────────────────┘
```

**Total LLM calls: 1-2** (vs current 4-12 in slow path)

---

## The Decision Tree (Your Insight)

### Phase 1: Hardened Prompt Generation

```
HARDENED PROMPT GENERATION (Phase 3)
    │
    ├─ LLM receives inspiration examples
    │
    ├─ For each restriction in forbidden task:
    │   │
    │   ├─ Does inspiration example cover this?
    │   │   ├─ YES → Tool Handoff Protocol
    │   │   │   └─ Reference tool in routing table
    │   │   │
    │   │   └─ NO → Hardened Refusal
    │   │       └─ Write refusal pattern in matrix
    │   │
    │   └─ Example decision:
    │       "Discounts" → Have commerce_transactions tool → Tool Handoff
    │       "Salary disclosure" → No tool available → Hardened Refusal
    │
    └─ Output: Routing table with mixed protocols
```

### Phase 2: Post-Processing

```
Parse routing table
    │
    ├─ Extract all Tool Handoff protocols
    │   └─ For each referenced tool:
    │       ├─ In DB? → Retrieve directly
    │       └─ Not in DB? → Generate compact version (1 LLM call)
    │
    └─ Hardened Refusals → No action needed (already in prompt)
```

---

## Example: Before vs After

### Before (Current Slow Path)
```
1. Tool extraction loop (4-12 LLM calls)
   ├─ Search DB for tool patterns
   ├─ Agentic tool calling
   ├─ Generate tool schema
   └─ Generate mock response
   
2. Insert tools into prompt template

3. Hardened prompt generation (1 LLM call)
   ├─ LLM sees tools
   ├─ LLM knows tools handle restrictions
   └─ Outputs "Call tool when needed"

Total: 5-13 LLM calls, 10-20s
```

### After (New Fast Path)
```
1. Hardened prompt generation (1 LLM call)
   ├─ LLM sees inspiration examples
   ├─ LLM decides: "Discounts → tool, Disclosure → refusal"
   ├─ LLM builds routing table
   └─ Outputs complete hardened prompt with matrix
   
2. Parse routing table (No LLM)
   └─ Extract: ["commerce_transactions"]
   
3. Retrieve/generate tools (0-1 LLM calls)
   ├─ commerce_transactions in DB? → Yes → Use it
   └─ Done

Total: 1-2 LLM calls, ~1-2s
```

---

## Key Changes from Previous Plan

### What Changed

**Previous plan:**
1. Generate tools first (compaction + mock seeding)
2. Then harden prompt around tools

**New plan:**
1. Harden prompt FIRST (LLM decides routing)
2. Extract tool references from hardened prompt
3. Generate only referenced tools

### Why This Is Better

1. **LLM does the intelligence:**
   - Decides what needs tools vs refusals
   - Uses inspiration examples optimally
   - No heuristics needed for tool selection

2. **Fewer LLM calls:**
   - Old: 4-12 tool calls + 1 hardening call
   - New: 1 hardening call + 0-2 tool calls

3. **More accurate:**
   - LLM sees full context (prompt + examples + attacks)
   - Better decisions than algorithmic selection
   - Natural language reasoning for routing

4. **Simpler implementation:**
   - No compaction logic needed (LLM handles it)
   - No thing consolidation heuristics (LLM groups)
   - Just parse output and retrieve/generate

---

## Updated Component Specifications

### 1. HardenedPromptGenerator (MODIFIED)
```
Interface:
  generateHardenedPromptWithRouting(
    systemPrompt: string,
    forbiddenTask: string,
    inspirationExamples: InspirationExample[],
    breachedAttacks: BreachedAttack[],
    callModel: (prompt) => Promise<string>
  ) → Promise<{
    hardenedPrompt: string;
    referencedTools: string[];
    routingMatrix: RoutingDecision[];
  }>;

Changes:
  - Input: Add inspiration examples directly to prompt
  - Prompt: Updated with routing table methodology
  - Output: Add referencedTools[] and routingMatrix[]
```

### 2. ToolReferenceExtractor (NEW)
```
Interface:
  extractToolReferences(
    hardenedPrompt: string,
    routingMatrix: RoutingDecision[]
  ) → string[];

Logic:
  - Parse routing table for "Tool Handoff Protocol" entries
  - Extract tool names from backticks
  - Return unique list
```

### 3. ToolRetriever (SIMPLIFIED)
```
Interface:
  retrieveOrGenerateTools(
    toolNames: string[],
    seedContext: SeedContext,
    callModel: (prompt) => Promise<string>
  ) → Promise<ToolDef[]>;

Logic:
  - For each tool name:
    ├─ Check DB → exists? → Use directly
    └─ Not found? → Generate from inspiration (compact)
  - No complex consolidation logic needed
```

### 4. MockResponseSeeder (Unchanged)
```
Same as before - template-based with 1 LLM call per tool
```

---

## Revised Implementation Plan

### Phase 1: Hardened Prompt with Routing (Week 1-2)

**1.1 Update step1.md template**
- Add inspiration examples section
- Clarify tool vs refusal decision process
- Add examples of routing table with tool references

**1.2 Update instructions_template_step1_full.md**
- Include `INSPIRATION_EXAMPLES_BLOCK` placeholder
- Update instructions for LLM to use examples for routing decisions

**1.3 Update generateHardenedPromptStep1FullInstructions()**
- Pass inspiration examples to prompt builder
- LLM receives full context

**1.4 Parse routing table from output**
- Extract tool references from backticks
- Build routing decision list

### Phase 2: Tool Post-Processing (Week 2-3)

**2.1 Build ToolReferenceExtractor**
- Parse routing table for Tool Handoff entries
- Extract tool names from markdown
- Return deduplicated list

**2.2 Build ToolRetriever**
- DB lookup for existing tools
- Compact generation for missing tools (1 LLM call)
- Mock response seeding

### Phase 3: Integration (Week 4)

**3.1 Modify scan-pipeline.ts**
- Pass inspiration examples to hardening
- Receive tool references from hardening
- Trigger tool post-processing

**3.2 Modify hardening.ts**
- Update generateHardenedPrompt() interface
- Return referenced tools
- Optional: Post-process tools immediately

**3.3 Update API routes**
- No changes needed (transparent)

### Phase 4: Testing (Week 5)

**4.1 Test routing decisions**
- Verify LLM picks right routing type
- Verify tools referenced when available
- Verify refusals when no tools

**4.2 Test tool extraction**
- Parse routing tables correctly
- Handle edge cases (no tools, all tools, mixed)

**4.3 Measure speedup**
- Target: 1-2s total (vs 8-15s)

---

## Expected Performance

| Metric | Current | New Fast Path | Improvement |
|--------|---------|---------------|-------------|
| **LLM calls** | 4-12 | 1-2 | **75-90% reduction** |
| **Time** | 8-15s | 1-2s | **87% faster** |
| **Cost** | $0.02-0.05 | $0.003-0.01 | **80% cheaper** |
| **Coverage** | 60% | 90%+ | **+50%** |

---

## Open Questions

1. **Routing table format:** Markdown tables vs JSON schema?
2. **Tool name format:** Backticks `tool_name` vs explicit "Use tool: X"?
3. **Compaction fallback:** If DB has detailed tool, can LLM reference it directly?
4. **Mock generation timing:** During hardening or post-processing?
5. **Error handling:** What if routing table has invalid tool references?

---

## References

**Key Files to Modify:**
- `uploads/hardening_prompts/step1.md` - Add inspiration examples section
- `uploads/hardening_prompts/instructions_template_step1_full.md` - Update template
- `src/lib/scan-prompts.ts` - Update generateHardenedPromptStep1FullInstructions()
- `src/lib/hardening.ts` - Modify generateHardenedPrompt() to return tool references
- `src/lib/scan-pipeline.ts` - Add tool post-processing phase

**Key Insight Files:**
- `uploads/hardening_prompts/step1.md` - Routing table matrix methodology
- `uploads/tool_generation_pattern/pages/tool_complexity_tiers.md` - Tier classifications
- `uploads/tool_generation_pattern/pages/mock_response_strategy.md` - Template patterns