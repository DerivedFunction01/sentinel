"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Zap,
  Building2,
  Rocket,
  Loader2,
  Shield,
  Coins,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { formatTokens } from "@/lib/token-formatter";

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  tokens: number;
  description: string;
  features: string[];
  icon: React.ComponentType<{ className?: string }>;
  highlighted?: boolean;
}

const PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 0,
    tokens: 0,
    description: "For trying out ToolRegistry",
    icon: Zap,
    features: [
      "0 scan tokens",
      "Up to 3 prompts per scan",
      "Basic model catalog",
      "Community support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    tokens: 49_000_000,
    description: "For teams testing regularly",
    icon: Rocket,
    highlighted: true,
    features: [
      "49,000,000 scan tokens",
      "Unlimited prompts per scan",
      "Full model catalog (340+)",
      "Import / export configurations",
      "Priority email support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 299,
    tokens: 299_000_000,
    description: "For organizations at scale",
    icon: Building2,
    features: [
      "299,000,000 scan tokens",
      "Unlimited everything",
      "Custom model endpoints",
      "SSO & audit logs",
      "Dedicated support engineer",
    ],
  },
];

export default function BillingPage() {
  const router = useRouter();
  const [processing, setProcessing] = useState<string | null>(null);

  const handlePurchase = async (plan: PricingPlan) => {
    setProcessing(plan.id);
    try {
      const res = await fetch("/api/token-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: plan.tokens,
          plan: plan.id,
          reason: `Purchase: ${plan.name} plan ($${plan.price}/mo)`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to submit");
        setProcessing(null);
        return;
      }
      toast.success("Payment request submitted", {
        description: `An admin will approve your ${plan.name} plan (${formatTokens(plan.tokens)}). You'll be notified when it's ready.`,
      });
      router.push("/dashboard/settings");
    } catch {
      setProcessing(null);
      toast.error("Something went wrong");
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/dashboard/settings">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Settings
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Billing & Plans
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a plan to get more scan tokens. Payment requests are reviewed
          by an admin — no credit card required during the beta.
        </p>
      </div>

      {/* Pricing tiers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          return (
            <Card
              key={plan.id}
              className={
                plan.highlighted
                  ? "border-blue-500/50 ring-1 ring-blue-500/20"
                  : ""
              }
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/15">
                    <Icon className="h-5 w-5 text-blue-400" />
                  </div>
                  {plan.highlighted && (
                    <Badge className="bg-blue-600 text-white">
                      Most Popular
                    </Badge>
                  )}
                </div>
                <CardTitle className="mt-2 text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">
                    ${plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-amber-400">
                  <Coins className="h-4 w-4" />
                  {formatTokens(plan.tokens)}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Separator />
                <ul className="space-y-2.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handlePurchase(plan)}
                  disabled={processing !== null}
                  className={
                    plan.highlighted
                      ? "w-full bg-blue-600 hover:bg-blue-700"
                      : "w-full"
                  }
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  {processing === plan.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing…
                    </>
                  ) : plan.price === 0 ? (
                    "Request Free Tokens"
                  ) : (
                    `Purchase ${plan.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Beta notice */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 shrink-0 text-blue-400" />
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                How billing works during beta
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                During the beta, all purchases are processed as admin approval
                requests — no credit card is charged. When you click
                &quot;Purchase&quot;, a token request is sent to the admin
                panel. Once approved, the tokens are credited to your account
                instantly. A real payment integration (Stripe) will replace this
                flow in production.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
