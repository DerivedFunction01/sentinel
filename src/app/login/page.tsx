"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LogoIcon } from "@/components/shared/logo";
import { Shield, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid email or password.");
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left — login form (dark) */}
      <div className="flex w-full flex-col justify-center bg-slate-950 px-6 py-12 sm:px-12 lg:w-[55%] lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo */}
          <Link href="/" className="mb-10 flex items-center gap-2">
            <LogoIcon size="md" />
            <span className="text-xl font-bold text-white">SentinelPrompt</span>
          </Link>

          <h1 className="text-3xl font-bold tracking-tight text-white">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Enter your credentials to access the platform.
          </p>

          {error && (
            <div className="mt-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-white">
                  Password
                </Label>
                <button
                  type="button"
                  className="text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
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
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-blue-400 hover:text-blue-300"
            >
              Sign up
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
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Learn more about SentinelPrompt
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
