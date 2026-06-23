# Refactor executeMultiStepHardening to Reduce Token Costs

## Problem Statement

The current `executeMultiStepHardening` function in `/workspace/src/lib/scan-prompts.ts` is a long pipeline with multiple sequential LLM calls, resulting in high token costs. The function currently runs 5-7 LLM calls per hardening operation.

## Background Context

The function performs:
1. Optimization prompt detection & translation (2 LLM calls)
2. Attack pattern summarization (1 LLM call)
3. Step 1: Tool delegation (1 LLM call)
4. Step 1.5: Compaction (1 LLM call)
5. Step 2: Guardrails addition (1 LLM call)

## User Requirements

1. **Disable optimization prompt steps** (don't delete, just comment out for potential future use)
2. **Attack summarization optimization**: Only pass judge verdicts/responses, not every single user/model output
3. **Guardrail strategy**: Follow tool generation pattern - when tools enforce restrictions, skip redundant prose guardrails

## Proposed Changes

### Module 1: Disable Optimization Prompt Steps (HIGH PRIORITY)

**Goal**: Comment out optimization prompt detection and translation steps to save ~30-40% tokens.

#### [MODIFY] [scan-prompts.ts](file:///workspace/src/lib/scan-prompts.ts)

- Comment out the opt detector call at line 559
- Comment out the opt translator call at lines 674-678
- Comment out the final append logic at line 679
- Keep all constants (`OPTIMIZATION_PROMPT`, `runOptDetector`, `runOptTranslator`) intact but unused
- Add clear comments explaining these are disabled for token optimization

**Implementation approach**:
```typescript
// ── Pre-step: Optimization Prompt Detection & Language Identification ──
// DISABLED FOR TOKEN OPTIMIZATION - commented out for potential future re-enablement
// const detectorResult = await runOptDetector(callModel, systemPrompt, trace);
// const detectedLanguage = detectorResult.language || "English";
// const workingPrompt = detectorResult.cleanedPrompt || systemPrompt;

// Use defaults when disabled
const detectedLanguage = "English";
const workingPrompt = systemPrompt; // Use original prompt directly
```

```typescript
// ── Post-step: Optimization Prompt Translation & Append ──
// DISABLED FOR TOKEN OPTIMIZATION - commented out for potential future re-enablement
// const translatedOptPrompt = await runOptTranslator(
//   callModel,
//   detectedLanguage,
//   trace,
// );
// finalPrompt = `${translatedOptPrompt}\n\n${finalPrompt.trim()}`;

// No optimization prompt appended when disabled
```

**Files to keep untouched** (for future re-enablement):
- `OPTIMIZATION_PROMPT` constant (line 253)
- `runOptDetector` function (lines 289-329)
- `runOptTranslator` function (lines 331-358)
- `getOptDetectorInstructions` and `getOptTranslatorInstructions` functions
- Template files in `/workspace/uploads/hardening_prompts/`:
  - `instructions_template_opt_detector.md`
  - `instructions_template_opt_translator.md`

**Impact**: Saves ~30-40% tokens by removing 2 LLM calls

---

### Module 2: Optimize Attack Summarization - Judge Response Only

**Goal**: Pass only judge verdicts and key reasoning to attack summarization, not full conversation traces.

#### [MODIFY] [scan-prompts.ts](file:///workspace/src/lib/scan-prompts.ts)

**Current behavior**: The attack summarization receives full attack prompts and potentially full model responses.

**New behavior**: Only pass:
- The attack prompt itself
- Judge verdict (LEAKED/DEFENDED)
- Key reasoning snippets (extracted from judge response)

**Implementation**:
```typescript
// Update attack summarization to only use judge responses
if (breachedAttacks.length > 0) {
  const attackSummaryInstructions = getAttackSummaryInstructions(breachedAttacks);
  try {
    const res = await callModel(attackSummaryInstructions);
    summarizedPatterns = extractTaggedContent(
      res,
      "<BEGIN_ATTACK_PATTERNS>",
      "</BEGIN_ATTACK_PATTERNS>",
    );
    // Trace only stores summarized patterns, not full traces
    if (trace) {
      trace.attackSummary = {
        promptSent: attackSummaryInstructions,
        output: summarizedPatterns || res,
        // REMOVED: Full conversation history
      };
    }
  } catch (err) {
    console.error("Attack summarization step failed:", err);
  }
}
```

**Impact**: Reduces context size by ~50-70% for this step, saving additional tokens

---

### Module 3: Conditional Guardrail Strategy Based on Tool Generation Pattern

**Goal**: Implement "Rules as Code" philosophy - skip Step 2 guardrails when tools enforce restrictions.

#### Background from Tool Generation Pattern

From [`core_philosophy_rule_triage.md`](file:///workspace/uploads/tool_generation_pattern/pages/core_philosophy_rule_triage.md):

> **Rules as Code, Not Prose** - Instead of embedding business rules in the system prompt as natural language instructions, encode them in tool definitions and let the backend enforce them.
>
> **Critical Rule**: Since tools are configured to enforce restrictions, do NOT write system prompt guardrails that hardcode direct refusals, policies, or specific answers. The prompt guardrails should solely instruct the LLM to call the tool and follow its output, avoiding duplicate or conflicting instructions.

#### Implementation Decision

**When tools are present AND enforce restrictions**: Skip Step 2 entirely (true "Rules as Code")

**When no tools OR tools don't enforce**: Run Step 2 with traditional guardrails

#### [MODIFY] [scan-prompts.ts](file:///workspace/src/lib/scan-prompts.ts)

```typescript
// ── Step 2: Guardrails Addition ──
// CRITICAL: Skip Step 2 when tools enforce restrictions (Rules as Code philosophy)
const hasEnforcingTools = recommendedTools && recommendedTools.length > 0;

if (hasEnforcingTools) {
  // Tools already enforce restrictions - skip redundant prose guardrails
  // This follows the "Rules as Code, Not Prose" principle
  finalPrompt = compactedPrompt;
  if (trace) {
    trace.step2Skipped = {
      reason: "Tools enforce restrictions - following Rules as Code philosophy",
      toolCount: recommendedTools.length,
    };
  }
} else {
  // No tools present - run traditional Step 2 guardrails
  const step2Instructions = getHardenedPromptStep2Instructions(
    compactedPrompt,
    forbiddenTask,
    breachedAttacks,
    recommendedTools,
    summarizedPatterns,
  );
  
  try {
    const res = await callModel(step2Instructions);
    finalPrompt = extractSystemPrompt(res || "");
    if (trace) {
      trace.step2 = {
        promptSent: step2Instructions,
        outputPrompt: finalPrompt,
      };
    }
  } catch (err) {
    console.error("Step 2 of prompt hardening failed:", err);
    finalPrompt = compactedPrompt;
  }
}
```

**Impact**: Saves ~20-25% tokens by eliminating 1 LLM call when tools are present

---

### Module 4: Additional Optimizations (Future Work)

These are lower priority and can be implemented later:

#### Token Budget Tracking
- Add optional token budget parameter
- Implement early exit after Step 1 if quality threshold met
- Skip compaction if changes are minimal

#### Template Caching
- Cache loaded templates to avoid repeated file I/O
- Preload templates at application startup

#### Delta-Based Processing
- Only pass changed portions between steps
- Avoid repeating full prompt in each LLM call

---

## Verification Plan

### Automated Tests

1. **Unit tests** for disabled optimization steps:
   - Verify opt detector is not called
   - Verify opt translator is not called
   - Verify final prompt doesn't include optimization text
   - Ensure code compiles and runs correctly

2. **Unit tests** for attack summarization:
   - Test with judge-only input
   - Verify reduced token count
   - Ensure pattern extraction still works

3. **Unit tests** for conditional Step 2:
   - Test with tools present (should skip)
   - Test without tools (should run)
   - Verify trace logging for skipped steps

4. **Integration tests**:
   - Run full pipeline with various configurations
   - Measure actual token reduction %
   - Verify hardening quality maintained

### Manual Verification

1. **Token cost analysis**:
   - Compare before/after token counts using OpenRouter API usage stats
   - Target: ≥50% total reduction
   - Breakdown:
     - Opt prompt removal: ~30-40%
     - Conditional Step 2: ~20-25% (when tools present)
     - Attack summarization optimization: ~5-10%

2. **Quality validation**:
   - Run same attack suite against hardened prompts
   - Ensure ≤5% degradation in defense rate
   - Verify tool enforcement works correctly

3. **Trace log review**:
   - Check that `step2Skipped` appears when tools present
   - Verify no opt detector/translators traces when disabled
   - Confirm attack summaries are concise

### Backward Compatibility

- Function signature remains unchanged
- Optional parameters added with sensible defaults
- Existing callers continue to work without modification

## Success Metrics

- **Token reduction**: ≥50% total
  - Opt prompt removal: ~30-40%
  - Conditional Step 2: ~20-25% (when applicable)
  - Attack summarization: ~5-10%
  
- **Cost savings**: ≥50% reduction in USD per hardening operation

- **Quality maintenance**: ≤5% degradation in breach detection rate

- **Code maintainability**: 
  - Disabled code clearly commented and preserved
  - Easy to re-enable optimization features if needed
  - Clear documentation of "Rules as Code" philosophy

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Quality degradation without opt prompts | Monitor breach rates; can re-enable if needed (code preserved) |
| Missing guardrails when skipping Step 2 | Tools enforce restrictions; verify tool coverage is complete |
| Attack summarization loses important context | Start conservative, only remove clearly unnecessary data |
| Breaking existing integrations | Maintain backward compatibility; add optional params only |
