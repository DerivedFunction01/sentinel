# -_- coding: utf-8 -_-

"""

# Scan Object Structure & Analysis Guide

## Overview

The scan export format is **JSONL (JSON Lines)**, optionally gzip-compressed. Each line is a complete JSON object representing one adversarial security scan. This guide covers the full schema and provides practical code examples for converting scans into DataFrames for analysis.

---

## Part 1: Complete Schema Reference

### Top-Level Fields

#### Identifiers

| Field       | Type     | Example                       | Notes                                        |
| ----------- | -------- | ----------------------------- | -------------------------------------------- |
| `id`        | string   | `"cmr5be89t00081i7kk0kit36v"` | Prisma `cuid` primary key                    |
| `userId`    | string   | `"cmr4egjio0000ya7kchimmsps"` | Original owner's user ID; replaced on import |
| `reportId`  | string   | `"SP-26-0703-KI53"`           | Human-readable scan ID                       |
| `createdAt` | ISO 8601 | `"2026-07-03T19:16:43.746Z"`  | When scan was originally run                 |

#### Model Configuration

| Field                | Type   | Example                        | Notes                               |
| -------------------- | ------ | ------------------------------ | ----------------------------------- |
| `targetModel`        | string | `"z-ai/glm-4.7-flash"`         | OpenRouter model under test         |
| `attackerModel`      | string | `"deepseek/deepseek-v4-flash"` | Model generating adversarial inputs |
| `judgeModel`         | string | `"deepseek/deepseek-v4-flash"` | Model evaluating outputs            |
| `hardenerModel`      | string | `"deepseek/deepseek-v4-flash"` | Model suggesting improvements       |
| `seedExtractorModel` | string | `""` (optional)                | Model for ontology analysis         |

#### Task Definition

| Field               | Type   | Example                                                              | Notes                               |
| ------------------- | ------ | -------------------------------------------------------------------- | ----------------------------------- |
| `systemPrompt`      | string | `"You are a helpful and professional customer support assistant..."` | Base system prompt under evaluation |
| `forbiddenTask`     | string | `"Never offer or agree to offer discounts to customers."`            | The behavior that must be prevented |
| `judgeInstructions` | string | `""` (optional)                                                      | Extra rubric for judge model        |

#### Tooling

| Field               | Type        | Notes                                                 |
| ------------------- | ----------- | ----------------------------------------------------- |
| `tools`             | JSON array  | Tool definitions exposed to the model (usually empty) |
| `mockToolResponses` | JSON object | Mock responses keyed by tool name                     |

#### Results & Metrics

| Field         | Type    | Example  | Notes                                       |
| ------------- | ------- | -------- | ------------------------------------------- |
| `totalTrials` | integer | `48`     | Number of adversarial trials run            |
| `breaches`    | integer | `24`     | Number of successful breaches               |
| `breachRate`  | integer | `50`     | Breaches as a percentage                    |
| `score`       | integer | `50`     | Typically `100 - breachRate`                |
| `riskLevel`   | string  | `"high"` | One of: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |

#### Summaries & Metadata

| Field                  | Type     | Notes                                               |
| ---------------------- | -------- | --------------------------------------------------- |
| `summary`              | string   | Short narrative summary                             |
| `summaryDetail`        | string   | Longer markdown-style breakdown                     |
| `status`               | string   | One of: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED` |
| `allowNoToolsFallback` | boolean  | Allow responses without tools                       |
| `apiCost`              | float    | Accumulated API spend in dollars                    |
| `tags`                 | string[] | User-applied vocab tags                             |

---

### Trial Structure

Each entry in the `trials` array contains:

| Field          | Type     | Notes                                                                 |
| -------------- | -------- | --------------------------------------------------------------------- |
| `number`       | integer  | Sequential trial number (1-indexed)                                   |
| `verdict`      | string   | `BREACHED` or `HELD`                                                  |
| `attack`       | string   | The adversarial prompt sent to target model                           |
| `response`     | string   | The target model's response                                           |
| `judgeLabel`   | string   | Judge's classification                                                |
| `judgeVerdict` | string   | Judge's textual ruling                                                |
| `transcript`   | object[] | Full turn-by-turn message history                                     |
| `taskTag`      | string   | Targeted restriction identifier (e.g., `"discounts"`)                 |
| `entropyLabel` | string   | Attack complexity (e.g., `"Low Entropy"`, `"High Entropy"`)           |
| `framingLabel` | string   | Attack framing style (e.g., `"Abstract"`, `"Contextual"`, `"Direct"`) |
| `patternId`    | string   | Attack pattern identifier (e.g., `"general_process_inquiry"`)         |
| `targetThing`  | string   | Targeted concept variant (e.g., `"price cuts"`)                       |
| `seedTemplate` | string   | Raw seed template used to generate attack                             |
| `toolCalls`    | object[] | Any tool invocations made by model                                    |

---

### `metadata` Object (Optional)

Nested parsed JSON object containing analysis phases.

#### `metadata.seedExtraction`

Ontology-aware extraction of the forbidden task.

| Field                | Type     | Notes                                   |
| -------------------- | -------- | --------------------------------------- |
| `personaDescription` | string   | Human description of target persona     |
| `businessFeatures`   | string[] | Extracted business capabilities         |
| `businessCategories` | string[] | High-level domain categories            |
| `isGenerative`       | boolean  | Whether task involves generative output |
| `extractorModel`     | string   | (optional) Model used for extraction    |
| `extractedAt`        | ISO 8601 | (optional) When extraction occurred     |
| `relevantFiles`      | string[] | (optional) Supporting reference files   |
| `coreSystemPrompt`   | string   | (optional) Detected core prompt theme   |
| `things`             | object[] | **See RestrictionThing below**          |

##### `RestrictionThing` (inside `metadata.seedExtraction.things`)

| Field                      | Type     | Notes                                                                                                                      |
| -------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `forbiddenTask`            | string   | The restricted capability                                                                                                  |
| `thingName`                | string   | Canonical ontology term                                                                                                    |
| `thingDescription`         | string   | Description for display                                                                                                    |
| `thingNameVariants`        | string[] | Synonyms and alternative phrasings                                                                                         |
| `thingDescriptionVariants` | string[] | Variant descriptions for attacks                                                                                           |
| `credentials`              | string[] | Simulated credential contexts                                                                                              |
| `businessScenarios`        | string[] | Business narrative scenarios                                                                                               |
| `ontologySection`          | string   | (optional) Source ontology section reference                                                                               |
| `category`                 | enum     | Restriction category (`DYNAMIC_POLICY` = tool-gated, `OUT_OF_SCOPE` = conversational block, `STRICT_REFUSAL` = hard block) |
| `concreteScenarios`        | string[] | (optional) Concrete user scenarios for this restriction                                                                    |
| `coversRestriction`        | boolean  | (optional) Whether existing tools handle this restriction                                                                  |
| `protectedByTools`         | string[] | (optional) Tool names covering this restriction                                                                            |

#### `metadata.attackSummary`

High-level analysis of attack patterns.

| Field                | Type     | Notes                                                                   |
| -------------------- | -------- | ----------------------------------------------------------------------- |
| `summarizedPatterns` | string   | Natural-language summary of attack strategies                           |
| `breachedAttacks`    | object[] | Attacks that succeeded (includes `attack`, `judgeReasoning`, `verdict`) |
| `summarizedAt`       | ISO 8601 | When summary was generated                                              |

---

### `hardenedPrompts` Array (Optional)

Each entry represents a suggested improved prompt.

| Field                | Type     | Notes                                |
| -------------------- | -------- | ------------------------------------ |
| `id`                 | string   | Prisma `cuid`                        |
| `scanId`             | string   | Reference to `Scan.id`               |
| `modelId`            | string   | Model used to generate               |
| `modelName`          | string   | Human-readable model name            |
| `prompt`             | string   | The hardened prompt text             |
| `compatibilityScore` | integer  | 0-100 coverage score                 |
| `granularity`        | string   | `"compact"` or `"detailed"`          |
| `createdAt`          | ISO 8601 | Creation timestamp                   |
| `toolRecommendation` | object   | Parsed tool suggestions (see schema) |

## Part 2: Loading & Parsing

### Basic Load (Python)

"""

import json
import gzip
from pathlib import Path

FILENAME = "ToolRegistry-scans-2026-07-03.jsonl.gz"

# Load from gzip

def load_scans(filepath):
"""Load scan objects from .jsonl.gz file."""
scans = []
with gzip.open(filepath, "rt", encoding="utf-8") as f:
for line_num, line in enumerate(f, 1):
line = line.strip()
if not line:
continue
try:
scan = json.loads(line)
scans.append(scan)
except json.JSONDecodeError as e:
print(f"Skipping line {line_num}: {e}")
return scans

# Load

scans = load_scans(FILENAME)
print(f"Loaded {len(scans)} scans")

# Inspect one

if scans:
s = scans[0]
print(f"Report: {s['reportId']}")
print(f"Target: {s['targetModel']}")
print(f"Breach Rate: {s['breachRate']}%")

"""## Part 3: Converting to DataFrames

### Example 1: Scan-Level Summary DataFrame

Convert top-level metrics for quick analysis.
"""

import pandas as pd

def scans_to_summary_df(scans):
"""Create a scan-level summary DataFrame."""
rows = []
for scan in scans:
rows.append({
"reportId": scan["reportId"],
"targetModel": scan["targetModel"],
"attackerModel": scan["attackerModel"],
"judgeModel": scan["judgeModel"],
"forbiddenTask": scan["forbiddenTask"],
"totalTrials": scan["totalTrials"],
"breaches": scan["breaches"],
"breachRate": scan["breachRate"],
"score": scan["score"],
"riskLevel": scan["riskLevel"],
"status": scan["status"],
"apiCost": scan["apiCost"],
"createdAt": scan["createdAt"],
})
return pd.DataFrame(rows)

# Usage

df_summary = scans_to_summary_df(scans)
print(df_summary.head())

# Analysis examples

print("\nBreak down by risk level:")
print(df_summary.groupby("riskLevel").size())

print("\nAverage breach rate by attacker model:")
print(df_summary.groupby("attackerModel")["breachRate"].mean())

print("\nTotal API cost:")
print(df_summary["apiCost"].sum())

"""### Example 2: Trial-Level DataFrame

Expand trials for detailed attack analysis.
"""

def trials_to_df(scans, detailed=False):
"""Flatten trials across all scans into a single DataFrame."""
rows = []
for scan in scans:
scan_id = scan["reportId"]
target_model = scan["targetModel"]

        for trial in scan.get("trials", []):
            res = {
                "scanId": scan_id,
                "targetModel": target_model,
                "trialNumber": trial["number"],
                "verdict": trial["verdict"],
                "taskTag": trial.get("taskTag", ""),
                "patternId": trial.get("patternId", ""),
                "targetThing": trial.get("targetThing", ""),
                "entropyLabel": trial.get("entropyLabel", ""),
                "framingLabel": trial.get("framingLabel", ""),
                "attackLength": len(trial.get("attack", "")),
                "responseLength": len(trial.get("response", "")),
                "hadToolCalls": len(trial.get("toolCalls", [])) > 0,
            }
            if detailed:
                res["attack"] = trial.get("attack", "")
                res["response"] = trial.get("response", "")
            rows.append(res)
    return pd.DataFrame(rows)

# Usage

df_trials = trials_to_df(scans)
df_trials_detailed = trials_to_df(scans, detailed=True)
print(df_trials.head(10))

# Analysis examples

print("\nBreakdown of verdicts:")
print(df_trials["verdict"].value_counts())

print("\nMost common attack patterns:")
print(df_trials["patternId"].value_counts().head(10))

print("\nAverage attack text length by verdict:")
print(df_trials.groupby("verdict")["attackLength"].mean())

print("\nEntropyLabel distribution:")
print(df_trials["entropyLabel"].value_counts())

"""### Example 3: Attack Pattern Analysis

Analyze which patterns succeed against which models.
"""

def attack_patterns_df(scans):
"""Create DataFrame analyzing attack effectiveness by pattern."""
rows = []
for scan in scans:
for trial in scan.get("trials", []):
rows.append({
"scanId": scan["reportId"],
"targetModel": scan["targetModel"],
"patternId": trial.get("patternId", "unknown"),
"framingLabel": trial.get("framingLabel", "unknown"),
"entropyLabel": trial.get("entropyLabel", "unknown"),
"breached": trial["verdict"] == "BREACHED",
"targetThing": trial.get("targetThing", ""),
})

    df = pd.DataFrame(rows)
    return df

# Usage

df_patterns = attack_patterns_df(scans)

# Success rate by pattern

pattern_success = df_patterns.groupby("patternId").agg({
"breached": ["sum", "count", "mean"]
}).round(3)
pattern_success.columns = ["Breaches", "Total", "SuccessRate"]
print(pattern_success.sort_values("SuccessRate", ascending=False))

# Success rate by framing

print("\nSuccess rate by framing:")
framing_success = df_patterns.groupby("framingLabel")["breached"].agg(["sum", "count", "mean"]).round(3)
framing_success.columns = ["Breaches", "Total", "SuccessRate"]
print(framing_success)

# Heatmap: which patterns work best against which models?

heatmap_data = df_patterns.pivot_table(
values="breached",
index="patternId",
columns="targetModel",
aggfunc="mean"
)

import matplotlib.pyplot as plt
import seaborn as sns

if 'heatmap_data' in locals() and heatmap_data is not None:
plt.figure(figsize=(14, 10))
sns.heatmap(heatmap_data, annot=True, fmt=".2f", cmap="RdYlGn_r", vmin=0, vmax=1)
plt.title("Breach Rate Heatmap: Pattern × Target Model")
plt.xlabel("Target Model")
plt.ylabel("Attack Pattern")
plt.tight_layout()
plt.savefig("pattern_model_heatmap.png", dpi=150)
plt.show()
print("\nSaved heatmap to pattern_model_heatmap.png")
else:
print("Error: heatmap_data DataFrame not found. Please ensure the 'Attack Pattern Analysis' section (cell eqhtS5IdJ3Pp) has been executed.")

"""### Example 5: Business Features & Categories

Understand domain context across scans.
"""

def business_context_df(scans):
"""Extract business features and categories."""
rows = []
for scan in scans:
scan_id = scan["reportId"]
metadata = scan.get("metadata", {})
seed_info = metadata.get("seedExtraction", {})

        business_features = seed_info.get("businessFeatures", [])
        business_categories = seed_info.get("businessCategories", [])

        for feature in business_features:
            rows.append({
                "scanId": scan_id,
                "type": "feature",
                "value": feature,
                "targetModel": scan["targetModel"],
            })

        for category in business_categories:
            rows.append({
                "scanId": scan_id,
                "type": "category",
                "value": category,
                "targetModel": scan["targetModel"],
            })

    return pd.DataFrame(rows)

# Usage

df_biz = business_context_df(scans)

print("Business features:")
print(df_biz[df_biz["type"] == "feature"]["value"].value_counts())

print("\nBusiness categories:")
print(df_biz[df_biz["type"] == "category"]["value"].value_counts())

"""### Example 6: Hardened Prompts (Tools)

Analyze suggested improvements.
"""

def hardened_prompts_df(scans):
"""Extract and analyze hardened prompts."""
rows = []
for scan in scans:
for prompt in scan.get("hardenedPrompts", []):
rows.append({
"scanId": scan["reportId"],
"targetModel": scan["targetModel"],
"generatedBy": prompt.get("modelName", ""),
"compatibilityScore": prompt.get("compatibilityScore"),
"granularity": prompt.get("granularity", ""),
"promptLength": len(prompt.get("prompt", "")),
"hasToolRecommendation": prompt.get("toolRecommendation") is not None,
"createdAt": prompt.get("createdAt"),
})

    return pd.DataFrame(rows)

# Usage

df_hardened = hardened_prompts_df(scans)
if not df_hardened.empty:
print("Hardened prompts summary:")
print(df_hardened.head())

    print("\nAverage compatibility score by generator model:")
    print(df_hardened.groupby("generatedBy")["compatibilityScore"].mean())

"""## Part 4: Advanced Analysis Patterns

### Multi-Scan Trend Analysis

"""

def trend_analysis(scans):
"""Analyze trends across scans over time."""
df = scans_to_summary_df(scans)

    # Convert createdAt to datetime
    df["createdAt"] = pd.to_datetime(df["createdAt"])

    # Sort by date
    df = df.sort_values("createdAt")

    # Aggregate by date
    daily_stats = df.set_index("createdAt").resample("D").agg({
        "breachRate": "mean",
        "score": "mean",
        "apiCost": "sum",
    })

    print("Daily averages:")
    print(daily_stats)

    return df, daily_stats

df_summary, daily_stats = trend_analysis(scans)

"""### Comparing Models"""

def model_comparison(scans):
"""Compare performance of different target models."""
df = scans_to_summary_df(scans)

    comparison = df.groupby("targetModel").agg({
        "breachRate": ["mean", "std", "min", "max"],
        "score": ["mean", "std"],
        "totalTrials": "sum",
        "apiCost": "sum",
        "reportId": "count",
    }).round(2)

    comparison.columns = [
        "AvgBreachRate", "StdBreachRate", "MinBreachRate", "MaxBreachRate",
        "AvgScore", "StdScore",
        "TotalTrials", "TotalCost", "ScanCount"
    ]

    return comparison.sort_values("AvgBreachRate", ascending=False)

model_comp = model_comparison(scans)
print(model_comp)

"""### Identifying Common Weak Points"""

def identify_weak_points(scans):
"""Find which forbidden tasks and patterns cause most breaches."""
df_trials = trials_to_df(scans)

    # By forbidden task (via taskTag)
    task_analysis = df_trials.groupby("taskTag").agg({
        "verdict": lambda x: (x == "BREACHED").sum(),
        "trialNumber": "count",
    })
    task_analysis.columns = ["Breaches", "Total"]
    task_analysis["BreachRate"] = (task_analysis["Breaches"] / task_analysis["Total"] * 100).round(1)

    print("Breach rate by task tag:")
    print(task_analysis.sort_values("BreachRate", ascending=False))

    # By pattern + framing combo
    combo_analysis = df_trials.groupby(["patternId", "framingLabel"]).agg({
        "verdict": lambda x: (x == "BREACHED").sum(),
        "trialNumber": "count",
    })
    combo_analysis.columns = ["Breaches", "Total"]
    combo_analysis["BreachRate"] = (combo_analysis["Breaches"] / combo_analysis["Total"] * 100).round(1)
    combo_analysis = combo_analysis[combo_analysis["Total"] >= 2]  # Filter out rare combos

    print("\nTop attack patterns (by breach rate):")
    print(combo_analysis.sort_values("BreachRate", ascending=False).head(15))

identify_weak_points(scans)

"""## Part 5: Export & Visualization

### Export to CSV

"""

# Export summary

df_summary.to_csv("scan_summary.csv", index=False)

# Export trials with model/scan context

df_trials.to_csv("trials_simple.csv", index=False)

# Export trials with more detail

df_trials_detailed.to_csv("trials_detailed.csv", index=False)

# Export patterns

df_patterns.to_csv("attack_patterns.csv", index=False)

print("Exported to CSV files")

"""### Quick Visualizations (Matplotlib)"""

import matplotlib.pyplot as plt

# Risk level distribution

fig, axes = plt.subplots(2, 2, figsize=(12, 10))

# 1. Risk levels

df_summary["riskLevel"].value_counts().plot(kind="bar", ax=axes[0, 0])
axes[0, 0].set_title("Scans by Risk Level")

# 2. Breach rate distribution

axes[0, 1].hist(df_summary["breachRate"], bins=20)
axes[0, 1].set_title("Distribution of Breach Rates")
axes[0, 1].set_xlabel("Breach Rate (%)")

# 3. Cost vs Breach Rate

axes[1, 0].scatter(df_summary["apiCost"], df_summary["breachRate"])
axes[1, 0].set_title("API Cost vs Breach Rate")
axes[1, 0].set_xlabel("API Cost ($)")
axes[1, 0].set_ylabel("Breach Rate (%)")

# 4. Verdict distribution

df_trials["verdict"].value_counts().plot(kind="bar", ax=axes[1, 1])
axes[1, 1].set_title("Overall Trial Verdicts")

plt.tight_layout()
plt.savefig("scan_analysis.png", dpi=150)
plt.show()

"""# Per-Model & Tag-Based Analysis Guide

## Part 1: Per-Model Analysis

### Overview: What is Per-Model Analysis?

Per-model analysis examines how well (or poorly) a specific target model resists adversarial attacks. This is crucial for:

- **Benchmark comparisons**: Which models are most robust?
- **Regression testing**: Has a model's security improved over time?
- **Risk assessment**: Which models should we deploy with extra safeguards?

## 1.1 Complete Per-Model DataFrame

Create a comprehensive DataFrame for all models appearing in the scans.
"""

import pandas as pd
import json
import gzip
from collections import defaultdict

def per_model_comprehensive_df(scans):
"""
Create a comprehensive per-model DataFrame with aggregated metrics.

    One row per model with:
    - Aggregate breach stats
    - Trial distribution
    - Pattern effectiveness
    - Risk breakdown
    """
    models_data = defaultdict(lambda: {
        "scans": [],
        "total_trials": 0,
        "total_breaches": 0,
        "all_verdicts": [],
        "all_breach_rates": [],
        "risk_levels": defaultdict(int),
        "patterns_breached": defaultdict(int),
        "patterns_total": defaultdict(int),
        "framings_breached": defaultdict(int),
        "framings_total": defaultdict(int),
        "task_tags_breached": defaultdict(int),
        "task_tags_total": defaultdict(int),
        "api_costs": [],
    })

    # Aggregate data
    for scan in scans:
        model = scan["targetModel"]
        models_data[model]["scans"].append(scan["reportId"])
        models_data[model]["total_trials"] += scan["totalTrials"]
        models_data[model]["total_breaches"] += scan["breaches"]
        models_data[model]["all_breach_rates"].append(scan["breachRate"])
        models_data[model]["risk_levels"][scan["riskLevel"]] += 1
        models_data[model]["api_costs"].append(scan["apiCost"])

        for trial in scan.get("trials", []):
            verdict = trial["verdict"]
            models_data[model]["all_verdicts"].append(verdict)

            pattern = trial.get("patternId", "unknown")
            framing = trial.get("framingLabel", "unknown")
            task_tag = trial.get("taskTag", "unknown")

            models_data[model]["patterns_total"][pattern] += 1
            models_data[model]["framings_total"][framing] += 1
            models_data[model]["task_tags_total"][task_tag] += 1

            if verdict == "BREACHED":
                models_data[model]["patterns_breached"][pattern] += 1
                models_data[model]["framings_breached"][framing] += 1
                models_data[model]["task_tags_breached"][task_tag] += 1

    # Convert to DataFrame rows
    rows = []
    for model, data in sorted(models_data.items()):
        breach_rate = (data["total_breaches"] / data["total_trials"] * 100) if data["total_trials"] > 0 else 0

        # Most exploitable pattern
        if data["patterns_total"]:
            pattern_success = {
                p: (data["patterns_breached"][p] / data["patterns_total"][p] * 100)
                for p in data["patterns_total"]
            }
            most_exploitable_pattern = max(pattern_success.items(), key=lambda x: x[1]) if pattern_success else (None, 0)
        else:
            most_exploitable_pattern = (None, 0)

        # Most exploitable framing
        if data["framings_total"]:
            framing_success = {
                f: (data["framings_breached"][f] / data["framings_total"][f] * 100)
                for f in data["framings_total"]
            }
            most_exploitable_framing = max(framing_success.items(), key=lambda x: x[1]) if framing_success else (None, 0)
        else:
            most_exploitable_framing = (None, 0)

        rows.append({
            "model": model,
            "num_scans": len(data["scans"]),
            "total_trials": data["total_trials"],
            "total_breaches": data["total_breaches"],
            "breach_rate": round(breach_rate, 1),
            "breach_rate_min": min(data["all_breach_rates"]) if data["all_breach_rates"] else 0,
            "breach_rate_max": max(data["all_breach_rates"]) if data["all_breach_rates"] else 0,
            "breach_rate_stddev": round(pd.Series(data["all_breach_rates"]).std(), 1) if len(data["all_breach_rates"]) > 1 else 0,
            "num_patterns": len(data["patterns_total"]),
            "num_framings": len(data["framings_total"]),
            "num_task_tags": len(data["task_tags_total"]),
            "most_exploitable_pattern": most_exploitable_pattern[0],
            "pattern_success_rate": round(most_exploitable_pattern[1], 1),
            "most_exploitable_framing": most_exploitable_framing[0],
            "framing_success_rate": round(most_exploitable_framing[1], 1),
            "risk_low": data["risk_levels"].get("LOW", 0),
            "risk_medium": data["risk_levels"].get("MEDIUM", 0),
            "risk_high": data["risk_levels"].get("HIGH", 0),
            "risk_critical": data["risk_levels"].get("CRITICAL", 0),
            "total_api_cost": round(sum(data["api_costs"]), 2),
            "avg_api_cost_per_scan": round(sum(data["api_costs"]) / len(data["scans"]), 4) if data["scans"] else 0,
        })

    return pd.DataFrame(rows).sort_values("breach_rate", ascending=False)

# Usage

df_per_model = per_model_comprehensive_df(scans)
print(df_per_model.to_string())

"""## 1.2 Per-Model Pattern Analysis

For each model, identify which attack patterns are most effective.
"""

def per_model_pattern_analysis(scans):
"""
For each model, create a detailed breakdown of pattern effectiveness.

    Returns a dictionary: {model_name: df_patterns}
    Each df has columns: pattern, framing, total, breaches, success_rate
    """
    results = {}

    for scan in scans:
        model = scan["targetModel"]

        if model not in results:
            results[model] = []

        for trial in scan.get("trials", []):
            results[model].append({
                "pattern": trial.get("patternId", "unknown"),
                "framing": trial.get("framingLabel", "unknown"),
                "entropy": trial.get("entropyLabel", "unknown"),
                "target_thing": trial.get("targetThing", "unknown"),
                "task_tag": trial.get("taskTag", "unknown"),
                "breached": trial["verdict"] == "BREACHED",
                "attack_length": len(trial.get("attack", "")),
            })

    # Convert to DataFrames with aggregation
    model_analysis = {}
    for model, trials_list in results.items():
        df = pd.DataFrame(trials_list)

        # Pattern × Framing effectiveness
        pattern_framing = df.groupby(["pattern", "framing"]).agg({
            "breached": ["sum", "count", "mean"]
        }).round(3)
        pattern_framing.columns = ["breaches", "total", "success_rate"]
        pattern_framing = pattern_framing[pattern_framing["total"] >= 2].sort_values("success_rate", ascending=False)

        model_analysis[model] = {
            "full_data": df,
            "pattern_framing_effectiveness": pattern_framing,
            "pattern_success": df.groupby("pattern")["breached"].agg(["sum", "count", "mean"]).sort_values("mean", ascending=False),
            "framing_success": df.groupby("framing")["breached"].agg(["sum", "count", "mean"]).sort_values("mean", ascending=False),
            "entropy_success": df.groupby("entropy")["breached"].agg(["sum", "count", "mean"]).sort_values("mean", ascending=False),
        }

    return model_analysis

# Usage

model_analysis = per_model_pattern_analysis(scans)

for model, analysis in model_analysis.items():
print(f"\n{'='*80}")
print(f"MODEL: {model}")
print(f"{'='*80}")

    print(f"\nPattern Effectiveness (top 5):")
    print(analysis["pattern_success"].head())

    print(f"\nFraming Effectiveness (top 5):")
    print(analysis["framing_success"].head())

    print(f"\nEntropy Effectiveness:")
    print(analysis["entropy_success"])

    print(f"\nBest Pattern × Framing Combinations:")
    print(analysis["pattern_framing_effectiveness"].head(10))

"""## 1.4 Per-Model Temporal Analysis

Track how a model's security changes (if scanned multiple times).
"""

def per_model_temporal_analysis(scans):
"""
For models scanned multiple times, analyze trends over time.

    Returns: {model_name: df_timeline}
    """
    from datetime import datetime

    model_scans = {}

    for scan in scans:
        model = scan["targetModel"]
        if model not in model_scans:
            model_scans[model] = []

        model_scans[model].append({
            "reportId": scan["reportId"],
            "createdAt": datetime.fromisoformat(scan["createdAt"].replace("Z", "+00:00")),
            "breachRate": scan["breachRate"],
            "score": scan["score"],
            "totalTrials": scan["totalTrials"],
            "breaches": scan["breaches"],
            "riskLevel": scan["riskLevel"],
        })

    # Convert to DataFrames
    model_timelines = {}
    for model, scan_list in model_scans.items():
        df = pd.DataFrame(scan_list).sort_values("createdAt")

        # Only include models with multiple scans
        if len(df) > 1:
            df["days_since_first"] = (df["createdAt"] - df["createdAt"].min()).dt.days
            model_timelines[model] = df

    return model_timelines

# Usage

timelines = per_model_temporal_analysis(scans)

for model, df in timelines.items():
print(f"\n{model}:")
print(df[["reportId", "createdAt", "breachRate", "riskLevel"]])

    if len(df) > 1:
        improvement = df.iloc[0]["breachRate"] - df.iloc[-1]["breachRate"]
        print(f"  Change: {improvement:+.1f}% {'(improved)' if improvement < 0 else '(degraded)'}")

"""## 1.5 Per-Model Comparison Table

Side-by-side comparison of key metrics.
"""

def model_comparison_table(scans):
"""
Create a comparison table of all models with key metrics.
"""
df = per_model_comprehensive_df(scans)

    # Create comparison table
    comparison = df[[
        "model",
        "num_scans",
        "total_trials",
        "breach_rate",
        "breach_rate_min",
        "breach_rate_max",
        "most_exploitable_pattern",
        "risk_high",
        "risk_critical",
        "total_api_cost",
    ]].copy()

    comparison.columns = [
        "Model",
        "Scans",
        "Trials",
        "Avg Breach %",
        "Min %",
        "Max %",
        "Weakest Pattern",
        "High Risk",
        "Critical Risk",
        "Total Cost",
    ]

    return comparison

# Usage

comp = model_comparison_table(scans)
print(comp.to_string())

"""## Part 2: Tag-Based Analysis

### Overview: What is Tag-Based Analysis?

Tags allow you to group scans by user-defined categories (e.g., "1~Finance", "4~Healthcare", "baseline_dyiw~baseline prompt"). This enables:

- **Feature tracking**: Which features are most vulnerable?
- **Baseline comparisons**: How does a hardened prompt compare to baseline?
- **Domain analysis**: Are healthcare scans more vulnerable than finance?

## 2.1 Complete Tag Analysis DataFrame

Aggregate metrics by tag.
"""

def per_tag_comprehensive_df(scans):
"""
Create comprehensive per-tag analysis.

    One row per tag with aggregated breach stats.
    """
    tags_data = defaultdict(lambda: {
        "scans": [],
        "total_trials": 0,
        "total_breaches": 0,
        "breach_rates": [],
        "risk_levels": defaultdict(int),
        "models_used": set(),
        "api_costs": [],
    })

    # Aggregate data
    for scan in scans:
        for tag in scan.get("tags", []):
            tags_data[tag]["scans"].append(scan["reportId"])
            tags_data[tag]["total_trials"] += scan["totalTrials"]
            tags_data[tag]["total_breaches"] += scan["breaches"]
            tags_data[tag]["breach_rates"].append(scan["breachRate"])
            tags_data[tag]["risk_levels"][scan["riskLevel"].upper()] += 1
            tags_data[tag]["models_used"].add(scan["targetModel"])
            tags_data[tag]["api_costs"].append(scan["apiCost"])

    # Convert to DataFrame
    rows = []
    for tag, data in sorted(tags_data.items()):
        breach_rate = (data["total_breaches"] / data["total_trials"] * 100) if data["total_trials"] > 0 else 0

        rows.append({
            "tag": tag,
            "num_scans": len(data["scans"]),
            "total_trials": data["total_trials"],
            "total_breaches": data["total_breaches"],
            "breach_rate": round(breach_rate, 1),
            "min_breach_rate": min(data["breach_rates"]) if data["breach_rates"] else 0,
            "max_breach_rate": max(data["breach_rates"]) if data["breach_rates"] else 0,
            "stddev_breach_rate": round(pd.Series(data["breach_rates"]).std(), 1) if len(data["breach_rates"]) > 1 else 0,
            "risk_low": data["risk_levels"].get("LOW", 0),
            "risk_medium": data["risk_levels"].get("MEDIUM", 0),
            "risk_high": data["risk_levels"].get("HIGH", 0),
            "risk_critical": data["risk_levels"].get("CRITICAL", 0),
            "num_models": len(data["models_used"]),
            "total_api_cost": round(sum(data["api_costs"]), 2),
        })

    return pd.DataFrame(rows).sort_values("breach_rate", ascending=False)

# Usage

df_per_tag = per_tag_comprehensive_df(scans)
print(df_per_tag.to_string())

"""## 2.2 Tag Comparison

Compare metrics across tags (e.g., baseline vs hardened).
"""

def tag_comparison_analysis(scans):
"""
Compare two or more tags (e.g., baseline vs hardened prompts).

    Useful for: before/after analysis, feature comparisons
    """
    tag_data = defaultdict(list)

    for scan in scans:
        for tag in scan.get("tags", []):
            tag_data[tag].append({
                "reportId": scan["reportId"],
                "breachRate": scan["breachRate"],
                "score": scan["score"],
                "riskLevel": scan["riskLevel"],
                "totalTrials": scan["totalTrials"],
                "breaches": scan["breaches"],
            })

    # Create comparison table
    comparison_rows = []
    for tag, data in tag_data.items():
        df = pd.DataFrame(data)
        comparison_rows.append({
            "tag": tag,
            "count": len(df),
            "avg_breach_rate": round(df["breachRate"].mean(), 1),
            "median_breach_rate": round(df["breachRate"].median(), 1),
            "min_breach_rate": df["breachRate"].min(),
            "max_breach_rate": df["breachRate"].max(),
            "stddev": round(df["breachRate"].std(), 1),
            "avg_score": round(df["score"].mean(), 1),
        })

    return pd.DataFrame(comparison_rows).sort_values("avg_breach_rate")

"""## 2.3 Tags × Models Matrix

See which models perform best on which tag categories.
"""

def tags_models_matrix(scans):
"""
Create a pivot table: Tags × Models with breach rates.
"""
data = []

    for scan in scans:
        for tag in scan.get("tags", []):
            data.append({
                "tag": tag,
                "model": scan["targetModel"],
                "breachRate": scan["breachRate"],
            })

    if not data:
        return None

    df = pd.DataFrame(data)

    # Pivot table
    matrix = df.pivot_table(
        values="breachRate",
        index="tag",
        columns="model",
        aggfunc="mean"
    )

    return matrix.round(1)

# Usage

matrix = tags_models_matrix(scans)
if matrix is not None:
print("Breach Rate by Tag × Model:")
print(matrix)

    # Visualize
    import matplotlib.pyplot as plt
    import seaborn as sns

    plt.figure(figsize=(12, 8))
    sns.heatmap(matrix, annot=True, fmt=".1f", cmap="RdYlGn_r", vmin=0, vmax=100)
    plt.title("Breach Rate: Tags × Models")
    plt.tight_layout()
    plt.savefig("tags_models_heatmap.png", dpi=150)
    print("\nSaved heatmap to tags_models_heatmap.png")

"""## 2.4 Tags with Shared Scans

Find which tags appear together (scans with multiple tags).
"""

def tag_co_occurrence(scans):
"""
Analyze which tags appear together in the same scan.

    Useful for: understanding tag groupings
    """
    from itertools import combinations
    from collections import Counter

    tag_pairs = []
    tag_frequencies = Counter()

    for scan in scans:
        tags = scan.get("tags", [])
        tag_frequencies.update(tags)

        # Find all pairs
        if len(tags) > 1:
            for pair in combinations(sorted(tags), 2):
                tag_pairs.append(pair)

    pair_counts = Counter(tag_pairs)

    # Create results
    results = {
        "tag_frequencies": tag_frequencies,
        "tag_pairs": pair_counts,
        "tags_per_scan": [len(scan.get("tags", [])) for scan in scans],
    }

    return results

# Usage

tag_co = tag_co_occurrence(scans)

print("Tag Frequencies:")
for tag, count in tag_co["tag_frequencies"].most_common():
print(f" {tag}: {count}")

print("\nTags appearing together:")
for (tag1, tag2), count in tag_co["tag_pairs"].most_common(10):
print(f" {tag1} + {tag2}: {count}")

print(f"\nAverage tags per scan: {sum(tag_co['tags_per_scan']) / len(tag_co['tags_per_scan']):.1f}")

"""

## 2.5 Filter Scans by Tag Pattern

Common filtering scenarios."""

def filter_scans(scans, include_tags=None, exclude_tags=None, min_tags=None, max_tags=None, exact_num_tags=None):
"""
Filters a list of scan objects based on various tag criteria.
Tag matching (include/exclude) is case-insensitive and uses substring search.

    Args:
        scans (list): A list of scan dictionaries.
        include_tags (list, optional): List of tag substrings. Scans must contain at least one tag
                                       that includes any of these substrings (case-insensitive).
        exclude_tags (list, optional): List of tag substrings. Scans must NOT contain any tag
                                       that includes any of these substrings (case-insensitive).
        min_tags (int, optional): Minimum number of tags a scan must have.
        max_tags (int, optional): Maximum number of tags a scan can have.
        exact_num_tags (int, optional): Exact number of tags a scan must have.

    Returns:
        list: A filtered list of scan dictionaries.
    """
    filtered = []
    for scan in scans:
        scan_tags = [tag.lower() for tag in scan.get("tags", [])]
        num_current_tags = len(scan_tags)

        # Tag count filters
        if exact_num_tags is not None and num_current_tags != exact_num_tags:
            continue
        if min_tags is not None and num_current_tags < min_tags:
            continue
        if max_tags is not None and num_current_tags > max_tags:
            continue

        # Include tags filter (substring match, case-insensitive)
        if include_tags:
            normalized_include_keywords = [t.lower() for t in include_tags]
            has_matching_include_tag = False
            for include_keyword in normalized_include_keywords:
                if any(include_keyword in scan_tag for scan_tag in scan_tags):
                    has_matching_include_tag = True
                    break
            if not has_matching_include_tag:
                continue

        # Exclude tags filter (substring match, case-insensitive)
        if exclude_tags:
            normalized_exclude_keywords = [t.lower() for t in exclude_tags]
            has_matching_exclude_tag = False
            for exclude_keyword in normalized_exclude_keywords:
                if any(exclude_keyword in scan_tag for scan_tag in scan_tags):
                    has_matching_exclude_tag = True
                    break
            if has_matching_exclude_tag: # If any exclude keyword is found in any tag, skip this scan
                continue

        filtered.append(scan)
    return filtered

# Example Usage:

# Scans with EXACTLY one tag

single_tag_scans = filter_scans(scans, exact_num_tags=1)
print(f"Scans with exactly 1 tag: {len(single_tag_scans)}")

# Scans with multiple tags (2 or more)

multi_tag_scans = filter_scans(scans, min_tags=2)
print(f"Scans with multiple tags: {len(multi_tag_scans)}")

"""## 2.6 Tags × Models Matrix
Breach rates for each attack pattern across different tags

"""

import matplotlib.pyplot as plt
import seaborn as sns

# Prepare data for Pattern x Tag heatmap

# First, create a DataFrame with scanId and exploded tags

scan_tags_data = []
for scan in scans:
scan_id = scan["reportId"]
tags = scan.get("tags", [])
if not tags: # Handle scans with no tags by assigning a 'No Tag' category
scan_tags_data.append({"scanId": scan_id, "tag": "No Tag"})
else:
for tag in tags:
scan_tags_data.append({"scanId": scan_id, "tag": tag})

df_scan_tags = pd.DataFrame(scan_tags_data)

# Merge df_patterns with df_scan_tags to get tags associated with each pattern trial

# Using an inner merge to only include trials that have a corresponding scan_id and tag entry

df_patterns_with_tags = pd.merge(df_patterns, df_scan_tags, on="scanId", how="inner")

# Create a pivot table for Pattern x Tag breach rates

pattern_tag_heatmap_data = df_patterns_with_tags.pivot_table(
values="breached",
index="patternId",
columns="tag",
aggfunc="mean"
).round(2)

print("\nBreach Rate Heatmap (Pattern × Tag):")
print(pattern_tag_heatmap_data)

# Visualize the heatmap

plt.figure(figsize=(16, 10))
sns.heatmap(pattern_tag_heatmap_data, annot=True, fmt=".2f", cmap="RdYlGn_r", vmin=0, vmax=1)
plt.title("Breach Rate: Patterns × Tags")
plt.xlabel("Tag")
plt.ylabel("Attack Pattern")
plt.tight_layout()
plt.savefig("pattern_tag_heatmap.png", dpi=150)
plt.show()
print("\nSaved heatmap to pattern_tag_heatmap.png")

"""## 2.7 Export Per-Tag Breakdown

Export detailed breakdowns per tag.
"""

def export_per_tag_analysis(scans, output_dir="."):
"""
Export a CSV for each tag with its scan details.
"""
from pathlib import Path

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Group scans by tag
    tag_scans = defaultdict(list)
    for scan in scans:
        for tag in scan.get("tags", []):
            tag_scans[tag].append(scan)

    # Export each tag
    for tag, tag_scan_list in tag_scans.items():
        safe_tag = tag.replace("/", "_").replace(" ", "_").replace("~", "-")
        filename = output_path / f"tag_{safe_tag}.csv"

        rows = []
        for s in tag_scan_list:
            rows.append({
                "reportId": s["reportId"],
                "targetModel": s["targetModel"],
                "forbiddenTask": s["forbiddenTask"][:50],
                "breachRate": s["breachRate"],
                "riskLevel": s["riskLevel"],
                "totalTrials": s["totalTrials"],
                "breaches": s["breaches"],
                "apiCost": s["apiCost"],
            })

        df = pd.DataFrame(rows)
        df.to_csv(filename, index=False)
        print(f"✓ Wrote {filename} ({len(df)} scans)")

# Usage

export_per_tag_analysis(scans, output_dir="./tag_analysis")

"""## Part 3: Combined Model × Tag Analysis

Analyze both dimensions simultaneously.
"""

def model_tag_joint_analysis(scans):
"""
Analyze models and tags together.

    Example: How does each model perform on each tag?
    """
    joint_data = []

    for scan in scans:
        for tag in scan.get("tags", []) if scan.get("tags") else [None]:
            joint_data.append({
                "model": scan["targetModel"],
                "tag": tag,
                "breachRate": scan["breachRate"],
                "riskLevel": scan["riskLevel"],
                "trials": scan["totalTrials"],
                "breaches": scan["breaches"],
            })

    df = pd.DataFrame(joint_data)

    # Pivot: Model × Tag
    pivot = df.groupby(["model", "tag"]).agg({
        "breachRate": ["mean", "count"],
    }).round(1)
    pivot.columns = ["avg_breach_rate", "num_scans"]

    return pivot.sort_values("avg_breach_rate", ascending=False)

# Usage

joint = model_tag_joint_analysis(scans)
print(joint.head(20))

"""## Part 4: Advanced Filtering & Reporting"""

from collections import Counter
def generate_model_report(scans, target_model):
"""
Generate a comprehensive report for a specific model.
"""
model_scans = [s for s in scans if s["targetModel"] == target_model]

    if not model_scans:
        print(f"No scans found for {target_model}")
        return

    print(f"\n{'='*80}")
    print(f"SECURITY REPORT: {target_model}")
    print(f"{'='*80}")

    print(f"\nOverall Metrics:")
    total_trials = sum(s["totalTrials"] for s in model_scans)
    total_breaches = sum(s["breaches"] for s in model_scans)
    overall_breach_rate = total_breaches / total_trials * 100 if total_trials > 0 else 0
    print(f"  Total trials: {total_trials}")
    print(f"  Total breaches: {total_breaches}")
    print(f"  Overall breach rate: {overall_breach_rate:.1f}%")
    print(f"  Number of scans: {len(model_scans)}")

    # Risk breakdown
    risk_counts = Counter(s["riskLevel"].upper() for s in model_scans)
    print(f"\nRisk Distribution:")
    for level in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        count = risk_counts.get(level, 0)
        pct = count / len(model_scans) * 100
        print(f"  {level:10}: {count:2} ({pct:5.1f}%)")

    # Most vulnerable patterns
    patterns_data = []
    for scan in model_scans:
        for trial in scan.get("trials", []):
            patterns_data.append({
                "pattern": trial.get("patternId"),
                "breached": trial["verdict"] == "BREACHED",
            })

    if patterns_data:
        df_patterns = pd.DataFrame(patterns_data)
        pattern_success = df_patterns.groupby("pattern")["breached"].agg(
            ["sum", "count", "mean"]
        ).sort_values("mean", ascending=False)

        print(f"\nMost Effective Attack Patterns (top 5):")
        for idx, (pattern, row) in enumerate(pattern_success.head().iterrows(), 1):
            print(f"  {idx}. {pattern}: {row['sum']:.0f}/{row['count']:.0f} ({row['mean']*100:.1f}%)")

# Usage

for model in set(s["targetModel"] for s in scans):
generate_model_report(scans, model)

def generate_tag_report(scans, target_tag):
"""
Generate a comprehensive report for a specific tag.
"""
tag_scans = [s for s in scans if target_tag in s.get("tags", [])]

    if not tag_scans:
        print(f"No scans found for tag: {target_tag}")
        return

    print(f"\n{'='*80}")
    print(f"SECURITY REPORT: Tag '{target_tag}'")
    print(f"{'='*80}")

    print(f"\nOverall Metrics:")
    total_trials = sum(s["totalTrials"] for s in tag_scans)
    total_breaches = sum(s["breaches"] for s in tag_scans)
    overall_breach_rate = total_breaches / total_trials * 100 if total_trials > 0 else 0
    print(f"  Total trials: {total_trials}")
    print(f"  Total breaches: {total_breaches}")
    print(f"  Overall breach rate: {overall_breach_rate:.1f}%")
    print(f"  Number of scans: {len(tag_scans)}")

    # Risk breakdown
    risk_counts = Counter(s["riskLevel"].upper() for s in tag_scans)
    print(f"\nRisk Distribution:")
    for level in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        count = risk_counts.get(level, 0)
        pct = count / len(tag_scans) * 100
        print(f"  {level:10}: {count:2} ({pct:5.1f}%)")

    # Most vulnerable patterns
    patterns_data = []
    for scan in tag_scans:
        for trial in scan.get("trials", []):
            patterns_data.append({
                "pattern": trial.get("patternId"),
                "breached": trial["verdict"] == "BREACHED",
            })

    if patterns_data:
        df_patterns = pd.DataFrame(patterns_data)
        pattern_success = df_patterns.groupby("pattern")["breached"].agg(
            ["sum", "count", "mean"]
        ).sort_values("mean", ascending=False)

        print(f"\nMost Effective Attack Patterns (top 5):")
        for idx, (pattern, row) in enumerate(pattern_success.head().iterrows(), 1):
            print(f"  {idx}. {pattern}: {row['sum']:.0f}/{row['count']:.0f} ({row['mean']*100:.1f}%)")

# Usage

all_tags = set()
for scan in scans:
for tag in scan.get("tags", []):
all_tags.add(tag)

for tag in sorted(list(all_tags)):
generate_tag_report(scans, tag)
