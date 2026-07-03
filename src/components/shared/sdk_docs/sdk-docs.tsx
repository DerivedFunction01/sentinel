"use client";

import { useState, useEffect, useRef } from "react";
import { CodeHighlight } from "@/components/shared/code-highlight";
import { Button } from "@/components/ui/button";
import { Copy, Terminal, FileCode, Check } from "lucide-react";
import { toast } from "sonner";
import { TrialVerdict } from "@/lib/enums";
import { getCodeSample, CODE_SAMPLES } from "./code_samples";
interface SdkDocsProps {
  apiKey?: string;
  deploymentId?: string;
  className?: string;
}

type Lang = "curl" | "python" | "node";
type Op =
  | "trigger"
  | "list"
  | "create"
  | "update"
  | "reevaluate"
  | "reevaluate-trial"
  | "confirm-reevaluate"
  | "confirm-batch-reevaluate"
  | "tool-extraction";

const OPS = [
  { id: "trigger", label: "Trigger Scan (POST)" },
  { id: "list", label: "List Profiles (GET)" },
  { id: "create", label: "Create Profile (POST)" },
  { id: "update", label: "Update Profile (PATCH)" },
  { id: "reevaluate", label: "Auto Re-evaluate All Breached (POST)" },
  { id: "reevaluate-trial", label: "Re-evaluate Single Trial (POST)" },
  { id: "confirm-reevaluate", label: "Confirm Single Re-evaluation (POST)" },
  {
    id: "confirm-batch-reevaluate",
    label: "Confirm Batch Re-evaluation (POST)",
  },
  { id: "tool-extraction", label: "Extract & Harden Tools (POST)" },
] as const;

const LANGS = [
  { id: "curl", label: "cURL", langKey: "bash" },
  { id: "python", label: "Python", langKey: "python" },
  { id: "node", label: "Node.js", langKey: "javascript" },
] as const;

export function SdkDocs({
  apiKey,
  deploymentId,
  className = "",
}: SdkDocsProps) {
  const [activeLang, setActiveLang] = useState<Lang>("curl");
  const [activeOp, setActiveOp] = useState<Op>("trigger");
  const [copied, setCopied] = useState(false);
  // Track hydration to avoid mismatch between server and client
  const [hasMounted, setHasMounted] = useState(false);
  // Store origin in a ref to access it synchronously during render
  const originRef = useRef("");

  useEffect(() => {
    // Set origin on client mount - this only runs in browser
    originRef.current = window.location.origin;
    setHasMounted(true);
  }, []);

  const token = apiKey || "YOUR_API_KEY";
  const depId = deploymentId || "DEPLOYMENT_ID";
  const origin = originRef.current;

  const handleCopy = () => {
    const code = getCodeSample(activeLang, activeOp, {
      token,
      depId,
      origin,
    });
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const getLangKey = (lang: Lang): string => {
    const langConfig = LANGS.find((l) => l.id === lang);
    return langConfig?.langKey || "bash";
  };

  if (!hasMounted) {
    return null; // or return a loading state
  }

  const code = getCodeSample(activeLang, activeOp, { token, depId, origin });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Code Playground Section */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Terminal className="h-4 w-4 text-blue-400" />
            SDK Integration Examples
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </Button>
        </div>

        {/* Language Tabs */}
        <div className="flex gap-2 border-b border-border">
          {LANGS.map((lang) => (
            <button
              key={lang.id}
              onClick={() => setActiveLang(lang.id as Lang)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                activeLang === lang.id
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

        {/* Operation Tabs */}
        <div className="flex gap-1 flex-wrap">
          {OPS.map((op) => (
            <button
              key={op.id}
              onClick={() => setActiveOp(op.id as Op)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                activeOp === op.id
                  ? "bg-blue-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>

        {/* Code Display */}
        <CodeHighlight
          code={code}
          language={getLangKey(activeLang)}
          className="bg-zinc-950/60 p-3"
        />
      </div>

      {/* Re-evaluate & Tool Extraction Section */}
      {(activeOp === "reevaluate" ||
        activeOp === "reevaluate-trial" ||
        activeOp === "confirm-reevaluate" ||
        activeOp === "confirm-batch-reevaluate" ||
        activeOp === "tool-extraction") && (
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-sm">
            {activeOp === "tool-extraction"
              ? "Tool Extraction & Hardening"
              : "Re-evaluation Workflow"}
          </h3>

          {activeOp === "confirm-batch-reevaluate" && (
            <div className="space-y-2 text-xs">
              <p className="text-muted-foreground">
                Batch confirmation response example:
              </p>
              <CodeHighlight
                code={`{
  "accepted": 2,
  "rejected": 1,
  "results": [
    {
      "trialNumber": 5,
      "previousVerdict": "${TrialVerdict.Breached}",
      "newVerdict": "${TrialVerdict.Defended}",
      "confirmedAt": "2025-01-15T10:30:00Z"
    },
    {
      "trialNumber": 7,
      "previousVerdict": "${TrialVerdict.Breached}",
      "newVerdict": "${TrialVerdict.Defended}",
      "confirmedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "proposals": [
    {
      "trialNumber": 2,
      "originalVerdict": "${TrialVerdict.Breached}",
      "proposedVerdict": "${TrialVerdict.Defended}",
      "justification": "Model successfully rejected attempt...",
      "attack": "Original attack prompt...",
      "response": "Model's original response...",
      "originalReasoning": "Original breach reasoning..."
    }
  ]
}`}
                language="json"
                className="bg-zinc-950/60 p-3"
              />
            </div>
          )}

          {activeOp === "reevaluate" && (
            <div className="space-y-3 text-xs">
              <p className="text-muted-foreground">
                Response includes proposals for overturned trials:
              </p>
              <CodeHighlight
                code={`{
  "scanId": "SP-26-0617-3Q91",
  "reevaluationId": "REEVAL-001",
  "breachedCount": 3,
  "proposalCount": 2,
  "tokensCost": 3,
  "proposals": [
    {
      "trialNumber": 5,
      "originalVerdict": "${TrialVerdict.Breached}",
      "proposedVerdict": "${TrialVerdict.Defended}",
      "justification": "Upon further review, the model successfully rejected...",
      "attack": "Original attack prompt...",
      "response": "Model's original response...",
      "originalReasoning": "Original breach reasoning..."
    }
  ]
}`}
                language="json"
                className="bg-zinc-950/60 p-3"
              />
            </div>
          )}

          {activeOp === "tool-extraction" && (
            <div className="space-y-3 text-xs">
              <p className="text-muted-foreground">
                Response includes extracted tools and mock responses:
              </p>
              <CodeHighlight
                code={`{
  "scanId": "SP-26-0617-3Q91",
  "status": "completed",
  "extractedTools": [
    {
      "type": "function",
      "function": {
        "name": "process_refund",
        "description": "Process refund requests with authorization checks",
        "parameters": {
          "type": "object",
          "properties": {
            "amount": {
              "type": "number",
              "description": "Refund amount in dollars"
            },
            "reason": {
              "type": "string",
              "description": "Reason for refund"
            }
          },
          "required": ["amount", "reason"]
        }
      }
    }
  ],
  "mockResponses": {
    "process_refund": {
      "status": "success",
      "confirmationId": "REF-12345"
    }
  },
  "recommendations": {
    "hardening": "Move business logic from prompt to tool definitions",
    "complexity": "detailed",
    "toolsGenerated": 1
  }
}`}
                language="json"
                className="bg-zinc-950/60 p-3"
              />
            </div>
          )}

          {/* Multi-Language Code Examples for Reevaluate */}
          <div className="space-y-4 pt-2">
            <h4 className="font-semibold text-foreground">
              Code Examples (All Languages):
            </h4>
            {LANGS.map((lang) => (
              <div
                key={lang.id}
                className="space-y-2 border-l-2 border-muted pl-4"
              >
                <p className="text-xs font-medium text-foreground">
                  {lang.label}
                </p>
                <CodeHighlight
                  code={getCodeSample(lang.id as Lang, activeOp, {
                    token,
                    depId,
                    origin,
                  })}
                  language={lang.langKey}
                  className="bg-zinc-950/60 p-3"
                />
              </div>
            ))}
          </div>

          {/* Workflow Explanation */}
          {(activeOp === "reevaluate" ||
            activeOp === "reevaluate-trial" ||
            activeOp === "confirm-reevaluate" ||
            activeOp === "confirm-batch-reevaluate" ||
            activeOp === "tool-extraction") && (
            <WorkflowExplanation activeOp={activeOp} token={token} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Separate component for workflow explanation
 * This keeps the main component cleaner and reusable
 */
function WorkflowExplanation({
  activeOp,
  token,
}: {
  activeOp: Op;
  token: string;
}) {
  return (
    <div className="bg-muted/30 rounded-lg p-4 space-y-3 text-xs border border-muted">
      {activeOp === "reevaluate" && (
        <div className="space-y-2">
          <h5 className="font-semibold text-foreground">
            Bulk Re-evaluation + Batch Confirm Workflow
          </h5>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>
              <strong className="text-foreground">Step 1:</strong> Auto
              re-evaluate all breached trials (costs N tokens, where N = number
              of breached trials)
            </li>
            <li>
              <strong className="text-foreground">Step 2:</strong> API returns
              proposals for trials that were overturned
            </li>
            <li>
              <strong className="text-foreground">Step 3:</strong> Review
              proposals, then batch confirm accepted ones (FREE)
            </li>
          </ul>
        </div>
      )}

      {activeOp === "reevaluate-trial" && (
        <div className="space-y-2">
          <h5 className="font-semibold text-foreground">
            Single Trial Re-evaluation
          </h5>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>
              <strong className="text-foreground">Cost:</strong> 1 token per
              trial
            </li>
            <li>
              <strong className="text-foreground">Response:</strong> Contains
              proposed verdict and reasoning if overturned
            </li>
            <li>
              <strong className="text-foreground">Next step:</strong> Confirm
              re-evaluation if you accept the proposal
            </li>
          </ul>
        </div>
      )}

      {activeOp === "confirm-reevaluate" && (
        <div className="space-y-2">
          <h5 className="font-semibold text-foreground">
            Confirm Single Re-evaluation
          </h5>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>
              <strong className="text-foreground">Cost:</strong> FREE
            </li>
            <li>Must provide the trial number, new verdict, and reasoning</li>
            <li>
              Only overturned trials (Breached → Defended) can be confirmed
            </li>
          </ul>
        </div>
      )}

      {activeOp === "confirm-batch-reevaluate" && (
        <div className="space-y-2">
          <h5 className="font-semibold text-foreground">
            Batch Confirm Re-evaluations
          </h5>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>
              <strong className="text-foreground">Cost:</strong> FREE
            </li>
            <li>Confirm multiple re-evaluations in a single request</li>
            <li>
              Only trials that were overturned from{" "}
              <code className="text-blue-400 bg-muted px-1 py-0.5 rounded">
                BREACHED
              </code>{" "}
              to{" "}
              <code className="text-blue-400 bg-muted px-1 py-0.5 rounded">
                DEFENDED
              </code>{" "}
              are included in proposals
            </li>
          </ul>
        </div>
      )}

      {activeOp === "tool-extraction" && (
        <div className="space-y-2">
          <h5 className="font-semibold text-foreground">
            Tool Extraction & Hardening
          </h5>
          <p className="text-muted-foreground mb-2">
            When hardening a system prompt, ToolRegistry can analyze the prompt
            for embedded business logic and recommend moving it into structured
            tool definitions.
          </p>
          <div className="space-y-2 text-muted-foreground">
            <div>
              <strong className="text-foreground block mb-1">
                Parameters:
              </strong>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong className="text-foreground">modelId</strong>{" "}
                  (optional): The prompt hardener model ID
                </li>
                <li>
                  <strong className="text-foreground">extractorModel</strong>
                  (optional): Model for tool extraction. Use larger models
                  (Claude, GPT-4o) for complex prompts
                </li>
                <li>
                  <strong className="text-foreground">granularity</strong>
                  (optional): "compact" (1-3 tools) or "detailed"
                  (domain-specific tools)
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
