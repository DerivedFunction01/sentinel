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

### Advanced Pattern: Stateful Tooling: State-Based Filtering with Revision IDs

For complex domains (finance, retail, inventory) where tools operate on **filtered states that evolve**, use a **version-control-like pattern** with `filter_id` and `filter_delta` instead of creating tools with deep parameter nesting or repeating filtering logic.

**The Pattern:**

1. **One Filtering/Query Tool** that accepts:
   - `filter_id` (nullable): Reference to a previous query result (enables branching/undo)
   - `filter_delta`: Additive and subtractive filter operations (`add_filters`, `remove_filters`)
   - Returns a new `filter_id` representing the filtered state

2. **Specialized Downstream Tools** that accept:
   - `filter_id` (required): A reference to filtered data from step 1
   - Tool-specific parameters for operations on that filtered state
   - No filter logic; they operate on the already-filtered result

**Why This Avoids Bloat:**

Instead of creating one mega-tool with 8 view modes or output formats, or 8 different tools all with nearly identical filtering criteria:

```
Tool 1: retail_query
  view_mode: "item_level" | "aggregate_by_payer" | "tax_breakdown" | "logistics_timeline" | ...
```

You create a composable architecture:

```
Tool 1: apply_filters
  filter_id: (optional reference to previous state)
  filter_delta: { add: [...], remove: [...] }
  → returns filter_id

Tool 2: kitchen_display
  filter_id: (required, from Tool 1)
  format_hints: {...}

Tool 3: tax_report
  filter_id: (required, from Tool 1)
  aggregation_level: "item" | "payer" | "category"

Tool 4: inventory_rebalance
  filter_id: (required, from Tool 1)
  mutation_batch: [...operations...]
```

Or, a single tool that that accepts a type of view or operation, and the filter `filter_id`

```
Tool 2: get_display
  filter_id (required, from Tool 1)
  display_type: "item_level" | "aggregate_by_payer" | "tax_breakdown" | "logistics_timeline" | "product_catalog"
```

**Capabilities:**

- **Undo/Branch**: LLM can reference an old `filter_id` + apply new filters to explore alternate paths without recomputing
- **State Sharing**: Same filtered result (`filter_id`) passed to multiple tools without duplication
- **Filter Composition**: Filters are first-class values; adding/removing filters is atomic and auditable
- **Tool Specialization**: Each tool owns its output format and operations, not filtering logic

**When to Use This Pattern:**

- Domain has complex, evolving filter states (portfolios, shopping carts, inventory views)
- Same filtered result is used by multiple downstream operations
- Filtering is expensive or stateful (not cheap to recompute)
- You need audit trails of filter changes (revision history)
- Multiple tools would otherwise duplicate "what data to operate on" logic

**Example Scenario (High-level):**

```
Query 1: apply_filters(filter_id=null, add_filters=[{category="electronics"}])
  → filter_id: "v1_electronics"

Query 2: apply_filters(filter_id="v1_electronics", add_filters=[{price_range="0-500"}])
  → filter_id: "v2_electronics_budget"

Query 3: kitchen_display(filter_id="v2_electronics_budget")
  → Displays filtered results in KDS format

Query 4: tax_report(filter_id="v2_electronics_budget")
  → Aggregates tax liability for the same filtered set

Query 5: apply_filters(filter_id="v1_electronics", add_filters=[{price_range="500-2000"}])
  → filter_id: "v3_electronics_premium"  (branched from v1, not v2)

Query 6: inventory_rebalance(filter_id="v3_electronics_premium", mutation_batch=[...])
  → Executes operations on the premium electronics filtered state
```

Without this pattern, you'd need either:

- One mega-tool with overlapping filter parameters in each operation
- Separate tools for each "filter + view mode" combination (bloat)
- Repeating filter logic across multiple tools (duplication)

**Implementation Considerations:**

- Backend must efficiently manage revision checkpoints (immutable snapshots or copy-on-write)
- LLM must understand that `filter_id` is a reference, not a value to inspect
- Mock responses for filtering tool return only the `filter_id` and metadata, not the filtered data itself
- Downstream tools accept `filter_id` and operate on backend's materialized state

See Stateful Tooling for more details
