## Summary: Key Principles

1. **Rules as Code:** Encode enforcement in tools; keep guidance in prompt
2. **Pareto Triage:** Only tool-ify critical, irreversible, or legally binding rules
3. **Scope Compression:** Combine related rules (same domain, same backend logic); split different domains
4. **Tier Selection:** Match tool complexity to validation complexity (binary gate, conditional, multi-stage)
5. **Universal Protocols:** Some tools are maximal-yet-minimal; simple businesses use fewer fields; complex ones use more
6. **Neutral Naming:** Tool names don't reveal gating ("discount_request" not "deny_discounts")
7. **Minimal Required Fields:** Route with operation + category; optional fields add context
8. **Frozen Taxonomies:** Enums reflect real entities, not linguistic variants
9. **If-Thens in Schema:** Constraints and precision modes encode backend logic
10. **Intent Recognition:** Teach the LLM to map user language (definitive vs. hedged) to execution modes
11. **Generic Mock Responses:** Never assume business state; parameter-agnostic; link to real endpoints
12. **Three Outputs:** Generator produces [new prompt + tools + guide/rationale] as a coherent package
13. **Auditability:** Tool calls and backend rules form a clear trail of what was enforced and why
14. **Avoid Tool Bloat:** Consolidate related tools; use alternative patterns when appropriate

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
