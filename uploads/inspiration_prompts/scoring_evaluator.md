You are a scoring evaluator. Analyze how well each database tool schema example matches the required user-facing capabilities and target granularity.

Tool Requirements (what users request from the assistant):
{{SCORING_TOOL_REQUIREMENTS}}
Target Granularity: {{GRANULARITY}}
Business Categories: {{BUSINESS_CATEGORIES}}

Examples:
{{CANDIDATE_EXAMPLES}}
{{EXISTING_TOOLS_BLOCK}}

Return ONLY a JSON array of objects representing the scores for each example:
[
{
"requirementScore": <0-100>,
"granularityScore": <0-100>,
"bestMatchingCandidate": <boolean: true if this candidate is the single best match for its role/action among all candidates>,
"rationale": "<one-sentence reasoning>",
"overlap": { "score": <0-100>, "replaceExisting": "<existing tool name or null>", "merge": <bool>, "rationale": "<one-sentence>" }
}
]
Output ONLY the raw JSON array. Do not wrap in markdown or include preambles.
