# Implementation Plan: Add BusinessCategory Filtering to Inspiration Retriever

## Problem Description

You're absolutely right - **the `inspirationRetriever` does NOT currently use `businessCategory`**, even though it should to pull more relevant examples!

The `BusinessCategory` infrastructure exists throughout your codebase but is completely ignored during inspiration retrieval. This means when extracting tools for a banking application, you might get retail/restaurant examples instead of finance-specific patterns.

### Current State Analysis

**✅ Database Schema** ([`schema.prisma`](file:///workspace/prisma/schema.prisma#L113-L128)):
- `ToolSchemaExample.businessCategories` field exists (String, default `"[GENERAL]"`)
- Stores JSON array of `BusinessCategory` enum values

**✅ Type Definitions** ([`types.ts`](file:///workspace/src/lib/types.ts#L55-L76)):
- `BusinessCategory` enum with 10 categories: `GENERAL`, `BUSINESS_UNIVERSAL`, `RETAIL_HOSPITALITY_RESTAURANT_TRANSPORTATION`, `LAW_FIRM`, `BANKING_FINANCE`, `MEDICAL_HOSPITAL`, `ACCOUNTING_FIRM`, `CYBER_FIRM`, `CIVICS_VOTING`, `PRIVACY`
- `ToolRecommendationItem` already has `businessCategories?: BusinessCategory[]` field

**✅ Tool Extractor** ([`tool-extractor.ts`](file:///workspace/src/lib/tool-extractor.ts#L355-L377)):
- Already parses `businessCategories` from LLM output
- Already includes `businessCategories` in tool recommendations

**❌ Inspiration Retriever** ([`inspiration-retriever.ts`](file:///workspace/src/lib/inspiration-retriever.ts)):
- Does NOT import or use `BusinessCategory` type
- Does NOT accept `businessCategories` parameter
- Does NOT filter examples by business category
- Does NOT score based on business category matching
- LLM prompt does NOT request business category prediction

**Result**: Business category data is collected but never used for retrieval, missing an opportunity to surface more contextually relevant examples.

## Proposed Changes

### [MODIFY] inspiration-retriever.ts

Add business category awareness to the inspiration retrieval logic:

1. **Import BusinessCategory type**
   - Add `BusinessCategory` to imports from `./types`

2. **Add optional parameter to retrieveInspirationExamples**
   - Add `businessCategories?: BusinessCategory[]` parameter
   - Pass through from caller ([`tool-extractor.ts`](file:///workspace/src/lib/tool-extractor.ts))

3. **Update scoring logic**
   - Add business category matching bonus to the scoring system
   - Examples matching requested business categories get higher priority
   - Maintain backward compatibility (if no categories specified, use current behavior)

4. **Update search prompt**
   - Modify the LLM prompt to also predict relevant business categories
   - Include business categories in the JSON output alongside `query` and `tags`

### [MODIFY] tool-extractor.ts

1. **Pass business context to inspiration retriever**
   - When calling `retrieveInspirationExamples`, determine relevant business categories from context
   - This could come from: user input, scan configuration, or LLM prediction

### Verification Plan

#### Automated Tests
- Verify `BusinessCategory` is imported in `inspiration-retriever.ts`
- Test that examples are filtered/scored correctly when business categories are provided
- Test backward compatibility when no business categories are specified
- Verify the LLM prompt generates business categories in the response

#### Manual Verification
- Check that existing tool examples in the database have proper `businessCategories` values
- Run a test extraction and verify inspiration examples are more relevant to the business context
- Review the trace output to confirm business categories are being used

## Implementation Notes

> [!IMPORTANT]
> The `businessCategories` field in `ToolSchemaExample` is currently a String (JSON array), not a native Prisma relation. This means we need to parse it manually when doing comparisons.

> [!TIP]
> Consider adding a database index on `businessCategories` if filtering by category becomes a common query pattern.

> [!CAUTION]
> Ensure backward compatibility with existing tool examples that may not have business categories set (default to `[GENERAL]`).
