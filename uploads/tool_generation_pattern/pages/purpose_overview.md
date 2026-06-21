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
