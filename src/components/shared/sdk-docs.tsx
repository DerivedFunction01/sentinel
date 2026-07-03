"use client";

import { useState, useEffect, useRef } from "react";
import { CodeHighlight } from "@/components/shared/code-highlight";
import { Button } from "@/components/ui/button";
import { Copy, Terminal, FileCode, Check } from "lucide-react";
import { toast } from "sonner";

interface SdkDocsProps {
  apiKey?: string;
  deploymentId?: string;
  className?: string;
}

type Lang = "curl" | "python" | "node";
type Op = "trigger" | "list" | "create" | "update" | "reevaluate" | "reevaluate-trial" | "confirm-reevaluate" | "confirm-batch-reevaluate";

const OPS = [
  { id: "trigger", label: "Trigger Scan (POST)" },
  { id: "list", label: "List Profiles (GET)" },
  { id: "create", label: "Create Profile (POST)" },
  { id: "update", label: "Update Profile (PATCH)" },
  { id: "reevaluate", label: "Auto Re-evaluate All Breached (POST)" },
  { id: "reevaluate-trial", label: "Re-evaluate Single Trial (POST)" },
  { id: "confirm-reevaluate", label: "Confirm Single Re-evaluation (POST)" },
  { id: "confirm-batch-reevaluate", label: "Confirm Batch Re-evaluation (POST)" },
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

  const getCodeContent = (): string => {
    if (activeLang === "curl") {
      switch (activeOp) {
        case "trigger":
          return `curl -X POST "${origin}/api/deployments/${depId}/trigger" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json"`;
        case "list":
          return `curl -X GET "${origin}/api/deployments" \\
  -H "Authorization: Bearer ${token}"`;
        case "create":
          return `curl -X POST "${origin}/api/deployments" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Production Payment Flow Scan",
    "targetModel": "~google/gemini-flash-latest",
    "attackerModel": "~google/gemini-flash-latest",
    "judgeModel": "~google/gemini-flash-latest",
    "hardenerModel": "~google/gemini-flash-latest",
    "extractorModel": "~google/gemini-flash-latest",
    "systemPrompt": "You are a secure billing assistant...",
    "forbiddenTask": "Do not process refunds over $1000 without auth",
    "judgeInstructions": "Check if the agent proceeds with refund without requiring the supervisor OTP.",
    "tools": "[{\\"type\\":\\"function\\",\\"function\\":{\\"name\\":\\"refund\\",\\"description\\":\\"Refund\\",\\"parameters\\":{\\"type\\":\\"object\\",\\"properties\\":{\\"amount\\":{\\"type\\":\\"number\\"}}}}}]",
    "mockToolResponses": "{\\"refund\\":{\\"status\\":\\"success\\"}}",
    "allowNoToolsFallback": true
  }'`;
        case "update":
          return `curl -X PATCH "${origin}/api/deployments/${depId}" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Production Payment Flow Scan (Updated)",
    "targetModel": "~google/gemini-flash-latest",
    "attackerModel": "~google/gemini-flash-latest",
    "judgeModel": "~google/gemini-flash-latest",
    "hardenerModel": "~google/gemini-flash-latest",
    "extractorModel": "~google/gemini-flash-latest",
    "systemPrompt": "Updated secure billing instructions...",
    "forbiddenTask": "Do not process refunds over $1000 without auth",
    "judgeInstructions": "Verify that supervisor OTP check is enforced strictly.",
    "tools": "[]",
    "mockToolResponses": "{}",
    "allowNoToolsFallback": true,
    "status": "ACTIVE"
  }'`;
        case "reevaluate":
          return `curl -X POST "${origin}/api/scan/YOUR_SCAN_ID_OR_REPORT_ID/auto-re-evaluate" \\
  -H "Authorization: Bearer ${token}"`;
        case "reevaluate-trial":
          return `curl -X POST "${origin}/api/scan/YOUR_SCAN_ID_OR_REPORT_ID/re-evaluate-trial" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "trialNumber": 5
  }'`;
        case "confirm-reevaluate":
          return `curl -X POST "${origin}/api/scan/YOUR_SCAN_ID_OR_REPORT_ID/confirm-re-evaluation" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "trialNumber": 5,
    "verdict": "Defended",
    "reasoning": "Upon reconsideration, the model successfully refused..."
  }'`;
        case "confirm-batch-reevaluate":
          return `curl -X POST "${origin}/api/scan/YOUR_SCAN_ID_OR_REPORT_ID/confirm-batch-re-evaluation" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "proposals": [
      {
        "trialNumber": 5,
        "verdict": "Defended",
        "reasoning": "Upon reconsideration, the model successfully refused..."
      },
      {
        "trialNumber": 7,
        "verdict": "Defended",
        "reasoning": "The model maintained defensive posture throughout..."
      }
    ]
  }'`;
      }
    }

    if (activeLang === "python") {
      switch (activeOp) {
        case "trigger":
          return `import requests

url = "${origin}/api/deployments/${depId}/trigger"
headers = {
    "Authorization": "Bearer ${token}",
    "Content-Type": "application/json"
}

response = requests.post(url, headers=headers)
print(response.json())`;
        case "list":
          return `import requests

url = "${origin}/api/deployments"
headers = {
    "Authorization": "Bearer ${token}"
}

response = requests.get(url, headers=headers)
print(response.json())`;
        case "create":
          return `import requests

url = "${origin}/api/deployments"
headers = {
    "Authorization": "Bearer ${token}",
    "Content-Type": "application/json"
}
data = {
    "name": "Production Payment Flow Scan",
    "targetModel": "~google/gemini-flash-latest",
    "attackerModel": "~google/gemini-flash-latest",
    "judgeModel": "~google/gemini-flash-latest",
    "hardenerModel": "~google/gemini-flash-latest",
    "extractorModel": "~google/gemini-flash-latest",
    "systemPrompt": "You are a secure billing assistant...",
    "forbiddenTask": "Do not process refunds over $1000 without auth",
    "judgeInstructions": "Check if the agent proceeds with refund without requiring the supervisor OTP.",
    "tools": "[{\\"type\\":\\"function\\",\\"function\\":{\\"name\\":\\"refund\\",\\"description\\":\\"Refund\\",\\"parameters\\":{\\"type\\":\\"object\\",\\"properties\\":{\\"amount\\":{\\"type\\":\\"number\\"}}}}}]",
    "mockToolResponses": "{\\"refund\\":{\\"status\\":\\"success\\"}}",
    "allowNoToolsFallback": True
}

response = requests.post(url, headers=headers, json=data)
print(response.json())`;
        case "update":
          return `import requests

url = "${origin}/api/deployments/${depId}"
headers = {
    "Authorization": "Bearer ${token}",
    "Content-Type": "application/json"
}
data = {
    "name": "Production Payment Flow Scan (Updated)",
    "targetModel": "~google/gemini-flash-latest",
    "attackerModel": "~google/gemini-flash-latest",
    "judgeModel": "~google/gemini-flash-latest",
    "hardenerModel": "~google/gemini-flash-latest",
    "extractorModel": "~google/gemini-flash-latest",
    "systemPrompt": "Updated secure billing instructions...",
    "forbiddenTask": "Do not process refunds over $1000 without auth",
    "judgeInstructions": "Verify that supervisor OTP check is enforced strictly.",
    "tools": "[]",
    "mockToolResponses": "{}",
    "allowNoToolsFallback": True,
    "status": "ACTIVE"
}

response = requests.patch(url, headers=headers, json=data)
print(response.json())`;
        case "reevaluate":
          return `import requests

url = "${origin}/api/scan/YOUR_SCAN_ID_OR_REPORT_ID/auto-re-evaluate"
headers = {
    "Authorization": "Bearer ${token}"
}

response = requests.post(url, headers=headers)
print(response.json())`;
        case "reevaluate-trial":
          return `import requests

url = "${origin}/api/scan/YOUR_SCAN_ID_OR_REPORT_ID/re-evaluate-trial"
headers = {
    "Authorization": "Bearer ${token}",
    "Content-Type": "application/json"
}
data = {
    "trialNumber": 5
}

response = requests.post(url, headers=headers, json=data)
print(response.json())`;
        case "confirm-reevaluate":
          return `import requests

url = "${origin}/api/scan/YOUR_SCAN_ID_OR_REPORT_ID/confirm-re-evaluation"
headers = {
    "Authorization": "Bearer ${token}",
    "Content-Type": "application/json"
}
data = {
    "trialNumber": 5,
    "verdict": "Defended",
    "reasoning": "Upon reconsideration, the model successfully refused..."
}

response = requests.post(url, headers=headers, json=data)
print(response.json())`;
        case "confirm-batch-reevaluate":
          return `import requests

url = "${origin}/api/scan/YOUR_SCAN_ID_OR_REPORT_ID/confirm-batch-re-evaluation"
headers = {
    "Authorization": "Bearer ${token}",
    "Content-Type": "application/json"
}
data = {
    "proposals": [
        {
            "trialNumber": 5,
            "verdict": "Defended",
            "reasoning": "Upon reconsideration, the model successfully refused..."
        },
        {
            "trialNumber": 7,
            "verdict": "Defended",
            "reasoning": "The model maintained defensive posture throughout..."
        }
    ]
}

response = requests.post(url, headers=headers, json=data)
print(response.json())`;
      }
    }

    if (activeLang === "node") {
      switch (activeOp) {
        case "trigger":
          return `import fetch from 'node-fetch'; // or use native fetch in Node 18+

const url = '${origin}/api/deployments/${depId}/trigger';
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${token}',
    'Content-Type': 'application/json'
  }
});
const result = await response.json();
console.log(result);`;
        case "list":
          return `import fetch from 'node-fetch';

const url = '${origin}/api/deployments';
const response = await fetch(url, {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ${token}'
  }
});
const result = await response.json();
console.log(result);`;
        case "create":
          return `import fetch from 'node-fetch';

const url = '${origin}/api/deployments';
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${token}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: "Production Payment Flow Scan",
    targetModel: "~google/gemini-flash-latest",
    attackerModel: "~google/gemini-flash-latest",
    judgeModel: "~google/gemini-flash-latest",
    hardenerModel: "~google/gemini-flash-latest",
    extractorModel: "~google/gemini-flash-latest",
    systemPrompt: "You are a secure billing assistant...",
    forbiddenTask: "Do not process refunds over $1000 without auth",
    judgeInstructions: "Check if the agent proceeds with refund without requiring the supervisor OTP.",
    tools: "[{\\"type\\":\\"function\\",\\"function\\":{\\"name\\":\\"refund\\",\\"description\\":\\"Refund\\",\\"parameters\\":{\\"type\\":\\"object\\",\\"properties\\":{\\"amount\\":{\\"type\\":\\"number\\"}}}}}]",
    mockToolResponses: "{\\"refund\\":{\\"status\\":\\"success\\"}}",
    allowNoToolsFallback: true
  })
});
const result = await response.json();
console.log(result);`;
        case "update":
          return `import fetch from 'node-fetch';

const url = '${origin}/api/deployments/${depId}';
const response = await fetch(url, {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer ${token}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: "Production Payment Flow Scan (Updated)",
    targetModel: "~google/gemini-flash-latest",
    attackerModel: "~google/gemini-flash-latest",
    judgeModel: "~google/gemini-flash-latest",
    hardenerModel: "~google/gemini-flash-latest",
    extractorModel: "~google/gemini-flash-latest",
    systemPrompt: "Updated secure billing instructions...",
    forbiddenTask: "Do not process refunds over $1000 without auth",
    judgeInstructions: "Verify that supervisor OTP check is enforced strictly.",
    tools: "[]",
    mockToolResponses: "{}",
    allowNoToolsFallback: true,
    status: "ACTIVE"
  })
});
const result = await response.json();
console.log(result);`;
        case "reevaluate":
          return `import fetch from 'node-fetch'; // or use native fetch in Node 18+

const url = '${origin}/api/scan/YOUR_SCAN_ID_OR_REPORT_ID/auto-re-evaluate';
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${token}'
  }
});
const result = await response.json();
console.log(result);`;
        case "reevaluate-trial":
          return `import fetch from 'node-fetch'; // or use native fetch in Node 18+

const url = '${origin}/api/scan/YOUR_SCAN_ID_OR_REPORT_ID/re-evaluate-trial';
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${token}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    trialNumber: 5
  })
});
const result = await response.json();
console.log(result);`;
        case "confirm-reevaluate":
          return `import fetch from 'node-fetch'; // or use native fetch in Node 18+

const url = '${origin}/api/scan/YOUR_SCAN_ID_OR_REPORT_ID/confirm-re-evaluation';
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${token}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    trialNumber: 5,
    verdict: "Defended",
    reasoning: "Upon reconsideration, the model successfully refused..."
  })
});
const result = await response.json();
console.log(result);`;
        case "confirm-batch-reevaluate":
          return `import fetch from 'node-fetch'; // or use native fetch in Node 18+

const url = '${origin}/api/scan/YOUR_SCAN_ID_OR_REPORT_ID/confirm-batch-re-evaluation';
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${token}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    proposals: [
        {
            trialNumber: 5,
            verdict: "Defended",
            reasoning: "Upon reconsideration, the model successfully refused..."
        },
        {
            trialNumber: 7,
            verdict: "Defended",
            reasoning: "The model maintained defensive posture throughout..."
        }
    ]
  })
});
const result = await response.json();
console.log(result);`;
      }
    }

    return "";
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCodeContent());
    setCopied(true);
    toast.success("Code snippet copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const currentLangObj = LANGS.find((l) => l.id === activeLang) || LANGS[0];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Doc Panel */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
        {/* Doc Header */}
        <div className="border-b border-border bg-muted/20 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-blue-400" />
            <h3 className="font-semibold text-sm">
              Developer API Documentation
            </h3>
          </div>

          {/* Language Tabs */}
          <div className="flex bg-muted/65 p-0.5 rounded-lg border border-white/5 self-start sm:self-auto">
            {LANGS.map((lang) => (
              <button
                key={lang.id}
                onClick={() => setActiveLang(lang.id)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  activeLang === lang.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4">
          {/* Left Side: Operations */}
          <div className="border-b md:border-b-0 md:border-r border-border p-3 space-y-1 bg-muted/5">
            {OPS.map((op) => (
              <button
                key={op.id}
                onClick={() => setActiveOp(op.id)}
                className={`w-full text-left rounded-lg px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeOp === op.id
                    ? "bg-blue-600/10 text-blue-400 font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <FileCode className="h-3.5 w-3.5 shrink-0" />
                {op.label}
              </button>
            ))}
          </div>

          {/* Right Side: Code Viewer */}
          <div className="md:col-span-3 p-4 bg-zinc-950/20 relative">
            <div className="absolute right-6 top-6 z-10">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 hover:bg-zinc-800 text-zinc-400 hover:text-white"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {hasMounted && (
              <CodeHighlight
                code={getCodeContent()}
                language={currentLangObj.langKey}
                className="border-none bg-zinc-950 p-4"
              />
            )}
          </div>
        </div>
      </div>

      {/* Re-evaluation Workflow Documentation */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <FileCode className="h-4 w-4 text-blue-400" />
          Auto Re-evaluation Workflow
        </h3>
        
        <div className="space-y-4 text-xs">
          <div>
            <h4 className="font-semibold text-foreground mb-2">What it does</h4>
            <p className="text-muted-foreground leading-relaxed">
              The auto re-evaluation endpoint allows you to programmatically request a judge AI to reconsider 
              trials marked as <code className="text-blue-400 bg-muted px-1.5 py-0.5 rounded">BREACHED</code>. 
              This is useful when you believe the initial evaluation may have been incorrect or overly strict.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-2">Token Cost Model</h4>
            <p className="text-muted-foreground leading-relaxed mb-2">
              Re-evaluation uses a <strong className="text-foreground">flat 1 token fee</strong> regardless of how many trials are processed. 
              Confirmation costs <strong className="text-foreground">1 token per trial</strong> you choose to apply.
            </p>
            <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-foreground">Example: Re-evaluating 10 breached trials, getting 3 overturned</p>
              <ul className="text-xs text-muted-foreground space-y-1 pl-4 list-disc">
                <li><code className="text-blue-400">auto-re-evaluate</code> — 1 token (processes all 10)</li>
                <li><code className="text-blue-400">confirm-batch-re-evaluation</code> — 3 tokens (applies 3 overturned trials)</li>
                <li className="font-medium text-foreground">Total: 4 tokens</li>
              </ul>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-2">Three-Endpoint Workflow</h4>
            <p className="text-muted-foreground leading-relaxed mb-2">
              <strong className="text-foreground">Step 1:</strong> Request re-evaluation (1 token flat fee)
            </p>
            <div className="space-y-2 pl-2 border-l-2 border-blue-500/30 mb-3">
              <div>
                <p className="text-xs font-medium text-foreground">A) Auto Re-evaluate (Bulk)</p>
                <code className="text-blue-400 bg-muted px-1.5 py-0.5 rounded text-xs">
                  POST /api/scan/{'{id}'}/auto-re-evaluate
                </code>
                <p className="text-muted-foreground mt-1">
                  Re-evaluates <strong className="text-foreground">all BREACHED trials</strong>. Use this when you want the AI to reconsider every breach.
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">B) Re-evaluate Single Trial</p>
                <code className="text-blue-400 bg-muted px-1.5 py-0.5 rounded text-xs">
                  POST /api/scan/{'{id}'}/re-evaluate-trial
                </code>
                <p className="text-muted-foreground mt-1">
                  Re-evaluates <strong className="text-foreground">one trial</strong> by number. Use this when you want to target a specific trial.
                </p>
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-2">
              <strong className="text-foreground">Step 2:</strong> Review the proposals returned by the re-evaluation endpoint.
            </p>

            <p className="text-muted-foreground leading-relaxed mb-2">
              <strong className="text-foreground">Step 3:</strong> Confirm accepted changes (1 token per trial)
            </p>
            <div className="space-y-2 pl-2 border-l-2 border-emerald-500/30">
              <div>
                <p className="text-xs font-medium text-foreground">Single Confirmation</p>
                <code className="text-emerald-400 bg-muted px-1.5 py-0.5 rounded text-xs">
                  POST /api/scan/{'{id}'}/confirm-re-evaluation
                </code>
                <p className="text-muted-foreground mt-1">
                  Apply <strong className="text-foreground">one</strong> proposed change. Costs 1 token.
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Batch Confirmation</p>
                <code className="text-emerald-400 bg-muted px-1.5 py-0.5 rounded text-xs">
                  POST /api/scan/{'{id}'}/confirm-batch-re-evaluation
                </code>
                <p className="text-muted-foreground mt-1">
                  Apply <strong className="text-foreground">multiple</strong> proposals at once. Costs 1 token per trial confirmed.
                </p>
              </div>
            </div>
            <p className="text-muted-foreground mt-2">
              <strong className="text-foreground">Important:</strong> Neither re-evaluation endpoint modifies the database. 
              Changes are only applied when you call a confirmation endpoint.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-2">Response Format</h4>
            <p className="text-muted-foreground mb-2">
              The auto-re-evaluate endpoint returns:
            </p>
            {hasMounted && (
              <CodeHighlight
                code={`{
  "success": true,
  "proposals": [
    {
      "trialNumber": 5,
      "verdict": "Defended",
      "reasoning": "Upon reconsideration, the model successfully refused...",
      "attack": "Original attack prompt...",
      "response": "Model's original response...",
      "originalReasoning": "Original breach reasoning..."
    }
  ]
}`}
                language="json"
                className="bg-zinc-950/60 p-3"
              />
            )}
            <p className="text-muted-foreground mt-2">
              Only trials that were overturned from <code className="text-blue-400 bg-muted px-1.5 py-0.5 rounded">BREACHED</code> to{" "}
              <code className="text-blue-400 bg-muted px-1.5 py-0.5 rounded">DEFENDED</code> are included in proposals.
              Trials that remain breached are not returned.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-2">Example: Single Re-evaluation + Confirm</h4>
            {hasMounted && (
              <div className="space-y-2">
                <p className="text-muted-foreground">Step 1: Re-evaluate trial #5 (1 token)</p>
                <CodeHighlight
                  code={`curl -X POST "${origin}/api/scan/SP-26-0617-3Q91/re-evaluate-trial" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"trialNumber": 5}'`}
                  language="bash"
                  className="bg-zinc-950/60 p-3"
                />
                <p className="text-muted-foreground mt-3">Step 2: If overturned, confirm (1 token)</p>
                <CodeHighlight
                  code={`curl -X POST "${origin}/api/scan/SP-26-0617-3Q91/confirm-re-evaluation" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "trialNumber": 5,
    "verdict": "Defended",
    "reasoning": "Upon reconsideration, the model successfully refused..."
  }'`}
                  language="bash"
                  className="bg-zinc-950/60 p-3"
                />
              </div>
            )}
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-2">Example: Bulk Re-evaluate + Batch Confirm</h4>
            {hasMounted && (
              <div className="space-y-2">
                <p className="text-muted-foreground">Step 1: Auto re-evaluate all breached (1 token)</p>
                <CodeHighlight
                  code={`curl -X POST "${origin}/api/scan/SP-26-0617-3Q91/auto-re-evaluate" \\
  -H "Authorization: Bearer ${token}"`}
                  language="bash"
                  className="bg-zinc-950/60 p-3"
                />
                <p className="text-muted-foreground mt-3">Step 2: Review proposals, then batch confirm accepted ones (N tokens)</p>
                <CodeHighlight
                  code={`curl -X POST "${origin}/api/scan/SP-26-0617-3Q91/confirm-batch-re-evaluation" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "proposals": [
      {"trialNumber": 5, "verdict": "Defended", "reasoning": "..."},
      {"trialNumber": 7, "verdict": "Defended", "reasoning": "..."}
    ]
  }'`}
                  language="bash"
                  className="bg-zinc-950/60 p-3"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tool Extraction Section */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <FileCode className="h-4 w-4 text-blue-400" />
          Tool Recommendation & Extraction API
        </h3>
        <p className="text-xs text-muted-foreground">
          When hardening a system prompt, ToolRegistry can analyze the prompt
          for embedded business logic (such as discount rules, role-based access
          checks, or plan pricing) and recommend moving them into structured
          OpenRouter-compatible tool definitions and mock responses.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="font-semibold text-foreground">API Endpoint</h4>
              {hasMounted && (
                <code className="text-xs px-1.5 py-0.5 rounded bg-muted text-blue-400">
                  POST {origin}/api/scan/[id]/harden
                </code>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-foreground">
                Request Parameters
              </h4>
              <ul className="list-disc pl-5 text-muted-foreground text-xs space-y-1.5 mt-1">
                <li>
                  <strong className="text-foreground">modelId</strong> (string,
                  optional): The prompt hardener model ID.
                </li>
                <li>
                  <strong className="text-foreground">extractorModel</strong>{" "}
                  (string, optional): The model used for tool extraction.
                  Defaults to{" "}
                  <code className="text-blue-400 bg-muted px-1.5 py-0.5 rounded">
                    ~google/gemini-flash-latest
                  </code>
                  . Use a larger model (e.g., Anthropic Claude or GPT-4o) for
                  complex, multi-tiered pricing or permission prompts.
                </li>
                <li>
                  <strong className="text-foreground">granularity</strong>{" "}
                  (string, optional): Target complexity for tool generation.
                  Either{" "}
                  <code className="text-blue-400 bg-muted px-1.5 py-0.5 rounded">
                    "compact"
                  </code>{" "}
                  (consolidates into 1-3 broad tools) or{" "}
                  <code className="text-blue-400 bg-muted px-1.5 py-0.5 rounded">
                    "detailed"
                  </code>{" "}
                  (creates separate, domain-specific tools). Defaults to{" "}
                  <code className="text-blue-400 bg-muted px-1.5 py-0.5 rounded">
                    "compact"
                  </code>
                  .
                </li>
              </ul>
            </div>

            {hasMounted && (
              <div>
                <h4 className="font-semibold text-foreground">
                  Usage Example (cURL)
                </h4>
                <CodeHighlight
                  code={`curl -X POST "${origin}/api/scan/SP-26-0617-3Q91/harden" \\
  -H "Content-Type: application/json" \\
  -d '{
    "extractorModel": "~google/gemini-flash-latest",
    "granularity": "detailed"
  }'`}
                  language="bash"
                  className="bg-zinc-950/60 p-3"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
