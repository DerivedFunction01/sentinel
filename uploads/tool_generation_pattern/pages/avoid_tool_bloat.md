## Avoid Tool Bloat

To prevent excessive token usage, cognitive overload, and interface latency, keep the number of active tools minimal. If the total number of tools exceeds 15 (or is trending towards it), apply consolidation and scope compression. At a critical threshold, consider whether you need an **orchestrator-like tool definition** instead of creating many granular enforcement tools.

### Rules for Avoiding Bloat:

1. **Consolidate Related Tools**: Merge tools sharing the same domain or backend layer. Instead of creating separate tools for `get_discounts`, `apply_refund`, and `check_loyalty`, consolidate them under a single `commerce_transactions` tool with a `category` enum (`"discount" | "refund" | "loyalty"`)

2. **Maximum Tool Limit (15 Tools)**: Never exceed 15 unique tool definitions. If you reach this limit, you must merge or eliminate lower-priority validation gates.

3. **Use Category and Operation Enums**: Expand existing tool schemas by adding or extending `category` or `operation` parameters rather than generating new standalone functions.

4. **Prune Redundant Logic**: Audit tools regularly. If two rules check similar boundaries (e.g. checking user roles for deleting files vs checking user roles for renaming files), merge them into a single file operation utility with parameterized access controls.

### Orchestrator-Like Tool Definitions: When to Use Them

If you find yourself creating many granular tools (e.g., separate tools for each user action type, content category, operation, or domain variant), consider whether an **orchestrator tool** is more appropriate.

**An orchestrator tool:**

- Accepts a broad `operation` or `action` enum that routes to different backend handlers
- Includes `category`, `context`, and `parameters` that specify _what_ to do, not the detailed mechanics
- Lets the backend decide specific enforcement logic based on the operation type
- Reduces the LLM's cognitive load by consolidating many related rules into one tool definition
- Scales as new operations are added without requiring new tool definitions

**When to use an orchestrator:**

- You have 10+ related operations that share the same enforcement principles (different rules for different contexts, but the _validation pattern_ is identical)
- Rules are frequently added, removed, or modified (orchestrator can handle new operations without regenerating the prompt)
- The backend can efficiently multiplex different operation types (it's cheaper and cleaner than 10 separate tools)
- The LLM doesn't need to understand the detailed mechanics of each operation; it just needs to route to the right one

**Example: Orchestrator vs. Granular**

**Granular (bloat):**

```
Tool 1: create_order
Tool 2: cancel_order
Tool 3: modify_order
Tool 4: view_order
Tool 5: apply_discount_to_order
Tool 6: refund_order
Tool 7: escalate_order
...
```

**Orchestrator (lean):**

```
Tool 1: order_management
  Parameters:
    - operation: "create" | "cancel" | "modify" | "view" | "escalate" | ...
    - order_id: string (optional for creation)
    - context: object (specific parameters depend on operation type)
Tool 2: discount_management
  Parameters:
    - operation: "apply" | "remove" | "inquiry" | ...
    - discount_id: string (optional)
    - context: object (specific parameters depend on operation type)
Tool 3: refund_management
  Parameters:
    - operation: "initiate" | "cancel" | "status" | "inquiry"| ...
    - refund_id: string (optional)
    - context: object (specific parameters depend on operation type)
```

**Tradeoff:**

- **Granular:** Single LLM agent understands each operation deeply (what parameters matter, why it's called); tool definitions are explicit; one model call to the right tool
- **Orchestrator:** Requires multiple model calls or agentic loops—first to route/recognize the operation, then to handle specifics with detailed parameters; backend owns enforcement logic; easier to extend without regenerating prompts; but adds latency and complexity

**Decision Rule:**

- If tools are **few and semantically distinct** (e.g., `finance_transfer` vs. `commerce_transactions`): Use granular tools
- If tools are **many and follow the same pattern** (e.g., 15 different CRUD or state-transition operations): Use an orchestrator
- If you're approaching 15 tools and they're mostly variants of the same enforcement logic: **Consolidate into an orchestrator**

### Advanced Patterns: Stateful Tooling

See [Stateful Tooling](/tool_generation_pattern/pages/stateful_tooling)
