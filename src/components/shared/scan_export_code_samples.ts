export type SectionId =
  | "loading"
  | "summary"
  | "trials"
  | "patterns"
  | "business"
  | "hardened"
  | "trends"
  | "models"
  | "weak-points"
  | "per-model"
  | "per-model-patterns"
  | "per-model-temporal"
  | "per-model-table"
  | "per-tag"
  | "tag-comparison"
  | "tags-models"
  | "filter-scans"
  | "export-tag"
  | "joint-analysis"
  | "model-report"
  | "tag-report";

export interface Section {
  id: SectionId;
  label: string;
  description: string;
  code: string;
}
export const SECTIONS: Section[] = [
  {
    id: "loading",
    label: "Loading Scans",
    description: "Load scan objects from a .jsonl.gz export file.",
    code: `import json
import gzip
from pathlib import Path

FILENAME = "ToolRegistry-scans-${new Date().toISOString().split("T")[0]}.jsonl.gz"

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

scans = load_scans(FILENAME)
print(f"Loaded {len(scans)} scans")

if scans:
    s = scans[0]
    print(f"Report: {s['reportId']}")
    print(f"Target: {s['targetModel']}")
    print(f"Breach Rate: {s['breachRate']}%")`,
  },
  {
    id: "summary",
    label: "Scan Summary",
    description: "Create a scan-level summary DataFrame for quick overview.",
    code: `import pandas as pd

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
            "defendedCount": scan.get("defendedCount", 0),
            "unknownCount": scan.get("unknownCount", 0),
            "score": scan["score"],
            "riskLevel": scan["riskLevel"],
            "status": scan["status"],
            "apiCost": scan["apiCost"],
            "createdAt": scan["createdAt"],
        })
    return pd.DataFrame(rows)

df_summary = scans_to_summary_df(scans)
print(df_summary.head())

print("\\nBreak down by risk level:")
print(df_summary.groupby("riskLevel").size())

print("\\nAverage breach rate by attacker model:")
print(df_summary.groupby("attackerModel")["breachRate"].mean())

print("\\nTotal API cost:")
print(df_summary["apiCost"].sum())`,
  },
  {
    id: "trials",
    label: "Trial-Level DataFrame",
    description: "Flatten all trials across scans into a single DataFrame.",
    code: `def trials_to_df(scans, detailed=False):
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

df_trials = trials_to_df(scans)
df_trials_detailed = trials_to_df(scans, detailed=True)
print(df_trials.head(10))

print("\\nBreakdown of verdicts:")
print(df_trials["verdict"].value_counts())

print("\\nMost common attack patterns:")
print(df_trials["patternId"].value_counts().head(10))

print("\\nAverage attack text length by verdict:")
print(df_trials.groupby("verdict")["attackLength"].mean())

print("\\nEntropyLabel distribution:")
print(df_trials["entropyLabel"].value_counts())`,
  },
  {
    id: "patterns",
    label: "Attack Patterns",
    description: "Analyze which attack patterns succeed against which models.",
    code: `def attack_patterns_df(scans):
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

df_patterns = attack_patterns_df(scans)

pattern_success = df_patterns.groupby("patternId").agg({
    "breached": ["sum", "count", "mean"]
}).round(3)
pattern_success.columns = ["Breaches", "Total", "SuccessRate"]
print(pattern_success.sort_values("SuccessRate", ascending=False))

print("\\nSuccess rate by framing:")
framing_success = df_patterns.groupby("framingLabel")["breached"].agg(["sum", "count", "mean"]).round(3)
framing_success.columns = ["Breaches", "Total", "SuccessRate"]
print(framing_success)

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
    print("\\nSaved heatmap to pattern_model_heatmap.png")
else:
    print("Error: heatmap_data not found.")`,
  },
  {
    id: "business",
    label: "Business Context",
    description:
      "Extract business features, categories, scenarios, and concrete scenarios from scan metadata.",
    code: `def business_context_df(scans):
    """Extract business features, categories, scenarios, and concrete scenarios."""
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

        # Extract scenarios from restriction things
        things = seed_info.get("things", [])
        for thing in things:
            for scenario in thing.get("businessScenarios", []):
                rows.append({
                    "scanId": scan_id,
                    "type": "business_scenario",
                    "value": scenario,
                    "targetModel": scan["targetModel"],
                })

            for scenario in thing.get("concreteScenarios", []):
                rows.append({
                    "scanId": scan_id,
                    "type": "concrete_scenario",
                    "value": scenario,
                    "targetModel": scan["targetModel"],
                })

    return pd.DataFrame(rows)

df_biz = business_context_df(scans)

print("Business features:")
print(df_biz[df_biz["type"] == "feature"]["value"].value_counts())

print("\\nBusiness categories:")
print(df_biz[df_biz["type"] == "category"]["value"].value_counts())

print("\\nBusiness scenarios:")
print(df_biz[df_biz["type"] == "business_scenario"]["value"].value_counts().head(10))

print("\\nConcrete scenarios:")
print(df_biz[df_biz["type"] == "concrete_scenario"]["value"].value_counts().head(10))`,
  },
  {
    id: "hardened",
    label: "Hardened Prompts",
    description: "Extract and analyze hardened prompt suggestions.",
    code: `def hardened_prompts_df(scans):
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

df_hardened = hardened_prompts_df(scans)
if not df_hardened.empty:
    print("Hardened prompts summary:")
    print(df_hardened.head())

    print("\\nAverage compatibility score by generator model:")
    print(df_hardened.groupby("generatedBy")["compatibilityScore"].mean())`,
  },
  {
    id: "trends",
    label: "Trend Analysis",
    description: "Analyze trends across scans over time.",
    code: `def trend_analysis(scans):
    """Analyze trends across scans over time."""
    df = scans_to_summary_df(scans)

    df["createdAt"] = pd.to_datetime(df["createdAt"])
    df = df.sort_values("createdAt")

    daily_stats = df.set_index("createdAt").resample("D").agg({
        "breachRate": "mean",
        "score": "mean",
        "apiCost": "sum",
    })

    print("Daily averages:")
    print(daily_stats)

    return df, daily_stats

df_summary, daily_stats = trend_analysis(scans)`,
  },
  {
    id: "models",
    label: "Comparing Models",
    description: "Compare performance of different target models.",
    code: `def model_comparison(scans):
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
print(model_comp)`,
  },
  {
    id: "weak-points",
    label: "Weak Points",
    description: "Find which forbidden tasks and patterns cause most breaches.",
    code: `def identify_weak_points(scans):
    """Find which forbidden tasks and patterns cause most breaches."""
    df_trials = trials_to_df(scans)

    task_analysis = df_trials.groupby("taskTag").agg({
        "verdict": lambda x: (x == "BREACHED").sum(),
        "trialNumber": "count",
    })
    task_analysis.columns = ["Breaches", "Total"]
    task_analysis["BreachRate"] = (task_analysis["Breaches"] / task_analysis["Total"] * 100).round(1)

    print("Breach rate by task tag:")
    print(task_analysis.sort_values("BreachRate", ascending=False))

    combo_analysis = df_trials.groupby(["patternId", "framingLabel"]).agg({
        "verdict": lambda x: (x == "BREACHED").sum(),
        "trialNumber": "count",
    })
    combo_analysis.columns = ["Breaches", "Total"]
    combo_analysis["BreachRate"] = (combo_analysis["Breaches"] / combo_analysis["Total"] * 100).round(1)
    combo_analysis = combo_analysis[combo_analysis["Total"] >= 2]

    print("\\nTop attack patterns (by breach rate):")
    print(combo_analysis.sort_values("BreachRate", ascending=False).head(15))

identify_weak_points(scans)`,
  },
  {
    id: "per-model",
    label: "Per-Model Analysis",
    description: "Comprehensive per-model DataFrame with aggregated metrics.",
    code: `import pandas as pd
import json
import gzip
from collections import defaultdict

def per_model_comprehensive_df(scans):
    """Create a comprehensive per-model DataFrame."""
    models_data = defaultdict(lambda: {
        "scans": [],
        "total_trials": 0,
        "total_breaches": 0,
        "total_defended": 0,
        "total_unknown": 0,
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

    for scan in scans:
        model = scan["targetModel"]
        models_data[model]["scans"].append(scan["reportId"])
        models_data[model]["total_trials"] += scan["totalTrials"]
        models_data[model]["total_breaches"] += scan["breaches"]
        models_data[model]["total_defended"] += scan.get("defendedCount", 0)
        models_data[model]["total_unknown"] += scan.get("unknownCount", 0)
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

    rows = []
    for model, data in sorted(models_data.items()):
        breach_rate = (data["total_breaches"] / data["total_trials"] * 100) if data["total_trials"] > 0 else 0

        pattern_success = {
            p: (data["patterns_breached"][p] / data["patterns_total"][p] * 100)
            for p in data["patterns_total"]
        }
        most_exploitable_pattern = max(pattern_success.items(), key=lambda x: x[1]) if pattern_success else (None, 0)

        framing_success = {
            f: (data["framings_breached"][f] / data["framings_total"][f] * 100)
            for f in data["framings_total"]
        }
        most_exploitable_framing = max(framing_success.items(), key=lambda x: x[1]) if framing_success else (None, 0)

        rows.append({
            "model": model,
            "num_scans": len(data["scans"]),
            "total_trials": data["total_trials"],
            "total_breaches": data["total_breaches"],
            "total_defended": data["total_defended"],
            "total_unknown": data["total_unknown"],
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

df_per_model = per_model_comprehensive_df(scans)
print(df_per_model.to_string())`,
  },
  {
    id: "per-model-patterns",
    label: "Per-Model Patterns",
    description: "Detailed pattern effectiveness breakdown per model.",
    code: `def per_model_pattern_analysis(scans):
    """For each model, detailed breakdown of pattern effectiveness."""
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

    model_analysis = {}
    for model, trials_list in results.items():
        df = pd.DataFrame(trials_list)

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

model_analysis = per_model_pattern_analysis(scans)

for model, analysis in model_analysis.items():
    print(f"\\n{'='*80}")
    print(f"MODEL: {model}")
    print(f"{'='*80}")

    print(f"\\nPattern Effectiveness (top 5):")
    print(analysis["pattern_success"].head())

    print(f"\\nFraming Effectiveness (top 5):")
    print(analysis["framing_success"].head())

    print(f"\\nEntropy Effectiveness:")
    print(analysis["entropy_success"])

    print(f"\\nBest Pattern × Framing Combinations:")
    print(analysis["pattern_framing_effectiveness"].head(10))`,
  },
  {
    id: "per-model-temporal",
    label: "Per-Model Temporal",
    description: "Track how a model's security changes over time.",
    code: `def per_model_temporal_analysis(scans):
    """For models scanned multiple times, analyze trends over time."""
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

    model_timelines = {}
    for model, scan_list in model_scans.items():
        df = pd.DataFrame(scan_list).sort_values("createdAt")

        if len(df) > 1:
            df["days_since_first"] = (df["createdAt"] - df["createdAt"].min()).dt.days
            model_timelines[model] = df

    return model_timelines

timelines = per_model_temporal_analysis(scans)

for model, df in timelines.items():
    print(f"\\n{model}:")
    print(df[["reportId", "createdAt", "breachRate", "riskLevel"]])

    if len(df) > 1:
        improvement = df.iloc[0]["breachRate"] - df.iloc[-1]["breachRate"]
        print(f"  Change: {improvement:+.1f}% {'(improved)' if improvement < 0 else '(degraded)'}")`,
  },
  {
    id: "per-model-table",
    label: "Per-Model Table",
    description: "Side-by-side comparison table of all models.",
    code: `def model_comparison_table(scans):
    """Create a comparison table of all models with key metrics."""
    df = per_model_comprehensive_df(scans)

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

comp = model_comparison_table(scans)
print(comp.to_string())`,
  },
  {
    id: "per-tag",
    label: "Per-Tag Analysis",
    description: "Aggregate metrics by user-defined tag.",
    code: `def per_tag_comprehensive_df(scans):
    """Create comprehensive per-tag analysis."""
    tags_data = defaultdict(lambda: {
        "scans": [],
        "total_trials": 0,
        "total_breaches": 0,
        "total_defended": 0,
        "total_unknown": 0,
        "breach_rates": [],
        "risk_levels": defaultdict(int),
        "models_used": set(),
        "api_costs": [],
    })

    for scan in scans:
        for tag in scan.get("tags", []):
            tags_data[tag]["scans"].append(scan["reportId"])
            tags_data[tag]["total_trials"] += scan["totalTrials"]
            tags_data[tag]["total_breaches"] += scan["breaches"]
            tags_data[tag]["total_defended"] += scan.get("defendedCount", 0)
            tags_data[tag]["total_unknown"] += scan.get("unknownCount", 0)
            tags_data[tag]["breach_rates"].append(scan["breachRate"])
            tags_data[tag]["risk_levels"][scan["riskLevel"].upper()] += 1
            tags_data[tag]["models_used"].add(scan["targetModel"])
            tags_data[tag]["api_costs"].append(scan["apiCost"])

    rows = []
    for tag, data in sorted(tags_data.items()):
        breach_rate = (data["total_breaches"] / data["total_trials"] * 100) if data["total_trials"] > 0 else 0

        rows.append({
            "tag": tag,
            "num_scans": len(data["scans"]),
            "total_trials": data["total_trials"],
            "total_breaches": data["total_breaches"],
            "total_defended": data["total_defended"],
            "total_unknown": data["total_unknown"],
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

df_per_tag = per_tag_comprehensive_df(scans)
print(df_per_tag.to_string())`,
  },
  {
    id: "tag-comparison",
    label: "Tag Comparison",
    description: "Compare metrics across tags (e.g., baseline vs hardened).",
    code: `def tag_comparison_analysis(scans):
    """Compare two or more tags (e.g., baseline vs hardened prompts)."""
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

    return pd.DataFrame(comparison_rows).sort_values("avg_breach_rate")`,
  },
  {
    id: "tags-models",
    label: "Tags × Models Matrix",
    description: "Pivot table showing breach rates for each tag across models.",
    code: `def tags_models_matrix(scans):
    """Create a pivot table: Tags × Models with breach rates."""
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

    matrix = df.pivot_table(
        values="breachRate",
        index="tag",
        columns="model",
        aggfunc="mean"
    )

    return matrix.round(1)

matrix = tags_models_matrix(scans)
if matrix is not None:
    print("Breach Rate by Tag × Model:")
    print(matrix)

    import matplotlib.pyplot as plt
    import seaborn as sns

    plt.figure(figsize=(12, 8))
    sns.heatmap(matrix, annot=True, fmt=".1f", cmap="RdYlGn_r", vmin=0, vmax=100)
    plt.title("Breach Rate: Tags × Models")
    plt.tight_layout()
    plt.savefig("tags_models_heatmap.png", dpi=150)
    print("\\nSaved heatmap to tags_models_heatmap.png")`,
  },
  {
    id: "filter-scans",
    label: "Filter Scans",
    description: "Filter scans by tag patterns, tag counts, and more.",
    code: `def filter_scans(scans, include_tags=None, exclude_tags=None, min_tags=None, max_tags=None, exact_num_tags=None):
    """
    Filters a list of scan objects based on various tag criteria.
    Tag matching is case-insensitive and uses substring search.
    """
    filtered = []
    for scan in scans:
        scan_tags = [tag.lower() for tag in scan.get("tags", [])]
        num_current_tags = len(scan_tags)

        if exact_num_tags is not None and num_current_tags != exact_num_tags:
            continue
        if min_tags is not None and num_current_tags < min_tags:
            continue
        if max_tags is not None and num_current_tags > max_tags:
            continue

        if include_tags:
            normalized_include_keywords = [t.lower() for t in include_tags]
            has_matching_include_tag = False
            for include_keyword in normalized_include_keywords:
                if any(include_keyword in scan_tag for scan_tag in scan_tags):
                    has_matching_include_tag = True
                    break
            if not has_matching_include_tag:
                continue

        if exclude_tags:
            normalized_exclude_keywords = [t.lower() for t in exclude_tags]
            has_matching_exclude_tag = False
            for exclude_keyword in normalized_exclude_keywords:
                if any(exclude_keyword in scan_tag for scan_tag in scan_tags):
                    has_matching_exclude_tag = True
                    break
            if has_matching_exclude_tag:
                continue

        filtered.append(scan)
    return filtered

single_tag_scans = filter_scans(scans, exact_num_tags=1)
print(f"Scans with exactly 1 tag: {len(single_tag_scans)}")

multi_tag_scans = filter_scans(scans, min_tags=2)
print(f"Scans with multiple tags: {len(multi_tag_scans)}")`,
  },
  {
    id: "export-tag",
    label: "Export Per-Tag",
    description: "Export a CSV for each tag with its scan details.",
    code: `def export_per_tag_analysis(scans, output_dir="."):
    """Export a CSV for each tag with its scan details."""
    from pathlib import Path

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    tag_scans = defaultdict(list)
    for scan in scans:
        for tag in scan.get("tags", []):
            tag_scans[tag].append(scan)

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
        print(f"Wrote {filename} ({len(df)} scans)")

export_per_tag_analysis(scans, output_dir="./tag_analysis")`,
  },
  {
    id: "joint-analysis",
    label: "Joint Analysis",
    description: "Analyze models and tags together in a single pivot.",
    code: `def model_tag_joint_analysis(scans):
    """Analyze models and tags together."""
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

    pivot = df.groupby(["model", "tag"]).agg({
        "breachRate": ["mean", "count"],
    }).round(1)
    pivot.columns = ["avg_breach_rate", "num_scans"]

    return pivot.sort_values("avg_breach_rate", ascending=False)

joint = model_tag_joint_analysis(scans)
print(joint.head(20))`,
  },
  {
    id: "model-report",
    label: "Model Report",
    description: "Generate a comprehensive report for a specific model.",
    code: `from collections import Counter

def generate_model_report(scans, target_model):
    """Generate a comprehensive report for a specific model."""
    model_scans = [s for s in scans if s["targetModel"] == target_model]

    if not model_scans:
        print(f"No scans found for {target_model}")
        return

    print(f"\\n{'='*80}")
    print(f"SECURITY REPORT: {target_model}")
    print(f"{'='*80}")

    print(f"\\nOverall Metrics:")
    total_trials = sum(s["totalTrials"] for s in model_scans)
    total_breaches = sum(s["breaches"] for s in model_scans)
    overall_breach_rate = total_breaches / total_trials * 100 if total_trials > 0 else 0
    print(f"  Total trials: {total_trials}")
    print(f"  Total breaches: {total_breaches}")
    print(f"  Overall breach rate: {overall_breach_rate:.1f}%")
    print(f"  Number of scans: {len(model_scans)}")

    risk_counts = Counter(s["riskLevel"].upper() for s in model_scans)
    print(f"\\nRisk Distribution:")
    for level in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        count = risk_counts.get(level, 0)
        pct = count / len(model_scans) * 100
        print(f"  {level:10}: {count:2} ({pct:5.1f}%)")

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

        print(f"\\nMost Effective Attack Patterns (top 5):")
        for idx, (pattern, row) in enumerate(pattern_success.head().iterrows(), 1):
            print(f"  {idx}. {pattern}: {row['sum']:.0f}/{row['count']:.0f} ({row['mean']*100:.1f}%)")

for model in set(s["targetModel"] for s in scans):
    generate_model_report(scans, model)`,
  },
  {
    id: "tag-report",
    label: "Tag Report",
    description: "Generate a comprehensive report for a specific tag.",
    code: `def generate_tag_report(scans, target_tag):
    """Generate a comprehensive report for a specific tag."""
    tag_scans = [s for s in scans if target_tag in s.get("tags", [])]

    if not tag_scans:
        print(f"No scans found for tag: {target_tag}")
        return

    print(f"\\n{'='*80}")
    print(f"SECURITY REPORT: Tag '{target_tag}'")
    print(f"{'='*80}")

    print(f"\\nOverall Metrics:")
    total_trials = sum(s["totalTrials"] for s in tag_scans)
    total_breaches = sum(s["breaches"] for s in tag_scans)
    overall_breach_rate = total_breaches / total_trials * 100 if total_trials > 0 else 0
    print(f"  Total trials: {total_trials}")
    print(f"  Total breaches: {total_breaches}")
    print(f"  Overall breach rate: {overall_breach_rate:.1f}%")
    print(f"  Number of scans: {len(tag_scans)}")

    risk_counts = Counter(s["riskLevel"].upper() for s in tag_scans)
    print(f"\\nRisk Distribution:")
    for level in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        count = risk_counts.get(level, 0)
        pct = count / len(tag_scans) * 100
        print(f"  {level:10}: {count:2} ({pct:5.1f}%)")

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

        print(f"\\nMost Effective Attack Patterns (top 5):")
        for idx, (pattern, row) in enumerate(pattern_success.head().iterrows(), 1):
            print(f"  {idx}. {pattern}: {row['sum']:.0f}/{row['count']:.0f} ({row['mean']*100:.1f}%)")

all_tags = set()
for scan in scans:
    for tag in scan.get("tags", []):
        all_tags.add(tag)

for tag in sorted(list(all_tags)):
    generate_tag_report(scans, tag)`,
  },
];
