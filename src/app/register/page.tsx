"use client"
import { APP_NAME } from "@/lib/constants";
;

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoIcon } from "@/components/shared/logo";
import { Shield, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, company }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed.");
        setLoading(false);
        return;
      }
      // Auto sign-in after registration
      await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left — register form (dark) */}
      <div className="flex w-full flex-col justify-center bg-slate-950 px-6 py-12 sm:px-12 lg:w-[55%] lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 flex items-center gap-2">
            <LogoIcon size="md" />
            <span className="text-xl font-bold text-white">{APP_NAME}</span>
          </Link>

          <h1 className="text-3xl font-bold tracking-tight text-white">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Start pentesting your AI system prompts in minutes.
          </p>

          {error && (
            <div className="mt-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white">
                Full Name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                className="border-slate-700 bg-slate-900 text-white placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="border-slate-700 bg-slate-900 text-white placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white">Company</Label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Inc."
                className="border-slate-700 bg-slate-900 text-white placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="border-slate-700 bg-slate-900 text-white placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 py-2.5 text-white hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-blue-400 hover:text-blue-300"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right — promotional card (beige) */}
      <div className="hidden items-center justify-center bg-stone-100 px-12 lg:flex lg:w-[45%]">
        <div className="max-w-md text-center">
          <LogoIcon className="mx-auto mb-8 shadow-sm" size="lg" />
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Proactive Input Defense
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Detect emotionally manipulative or high-risk prompts before any
            harmful output occurs, protecting your AI systems at the source.
          </p>
        </div>
      </div>
    </div>
  );
}
