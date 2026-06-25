import Link from "next/link";
import {
  ArrowRight,
  Shield,
  Target,
  Gavel,
  ScanSearch,
  FileBarChart,
  ShieldPlus,
  BookOpen,
  Zap,
  Lock,
  CheckCircle2,
  Menu,
} from "lucide-react";
import { LogoIcon } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { LandingSection } from "@/lib/enums";

const navLinks: { label: string; href: string }[] = [
  { label: "How it works", href: `#${LandingSection.HowItWorks}` },
  { label: "What you get", href: `#${LandingSection.WhatYouGet}` },
  // { label: "Research", href: `#${LandingSection.Research}` },
  // { label: "Docs", href: `#${LandingSection.Products}` },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <Guardrails />
        <ThreeAgents />
        <Methodology />
        <WhatYouGet />
        {/* <Research /> */}
        <Products />
        {/* <FinalCTA /> */}
      </main>
      <LandingFooter />
    </div>
  );
}

/* ── Header ── */
function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <LogoIcon size="sm" />
          <span className="text-lg font-bold tracking-tight text-slate-900">
            ToolRegistry
          </span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            className="hidden sm:inline-flex text-slate-600 hover:text-slate-900"
          >
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/register">
              Get started
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ── Hero ── */
function Hero() {
  return (
    <section
      id={LandingSection.Hero}
      className="relative overflow-hidden bg-slate-950 py-20 sm:py-28"
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 30%, rgba(59,130,246,0.15) 0%, transparent 50%), radial-gradient(circle at 75% 70%, rgba(59,130,246,0.08) 0%, transparent 50%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-blue-400">
            <Zap className="h-3.5 w-3.5" />
            Adversarial AI prompt security
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Pentest your AI the way a real attacker would.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-slate-300">
            ToolRegistry puts your system prompt under sustained adversarial
            pressure, scores it, and hands you back a hardened version — all in
            minutes. Here&apos;s what happens behind the scenes:
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              <Link href="/login">
                See how it works
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-slate-700 bg-transparent text-blue-400 hover:bg-slate-900 hover:text-blue-300"
            >
              <Link href="/dashboard/reports">See your reports</Link>
            </Button>
          </div>
        </div>
        <HeroDashboardPreview />
      </div>
    </section>
  );
}

function HeroDashboardPreview() {
  return (
    <div className="relative">
      <div className="rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-blue-500/10">
        <div className="flex items-center gap-1.5 border-b border-slate-800 px-4 py-3">
          <div className="h-3 w-3 rounded-full bg-red-500/70" />
          <div className="h-3 w-3 rounded-full bg-amber-500/70" />
          <div className="h-3 w-3 rounded-full bg-emerald-500/70" />
          <span className="ml-3 text-xs text-slate-500">
            ToolRegistry.app/dashboard
          </span>
        </div>
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Security Score</p>
              <p className="text-3xl font-bold text-emerald-400">88 / 100</p>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
              LOW RISK
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Trials", value: "26" },
              { label: "Breaches", value: "3" },
              { label: "Breach Rate", value: "12%" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
              >
                <p className="text-lg font-bold text-white">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {[
              { n: "01", v: "Breached", c: "text-red-400" },
              { n: "02", v: "Defended", c: "text-emerald-400" },
              { n: "03", v: "Defended", c: "text-emerald-400" },
            ].map((t) => (
              <div
                key={t.n}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2"
              >
                <span className="text-xs text-slate-400">Trial {t.n}</span>
                <span className={`text-xs font-medium ${t.c}`}>{t.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Guardrails (light) ── */
function Guardrails() {
  return (
    <section className="bg-stone-50 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-600">
          The Guardrails
        </p>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Your guardrails are written in language, not code.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-600">
          Every generative AI feature you ship is governed by a system prompt —
          the hidden instructions that tell the model how to behave, what it may
          say, and what it must never reveal. Traditional security tools scan
          code and infrastructure. None of them inspect the natural language
          instructions that actually control your AI&apos;s behavior.
          ToolRegistry closes that gap.
        </p>
      </div>
    </section>
  );
}

/* ── Three Agents (light) ── */
function ThreeAgents() {
  const agents = [
    {
      num: "1",
      icon: Target,
      title: "The Attacker generates adversarial prompts",
      body: "Acting as a stress-test, the Attacker writes a diverse library of attack messages — spanning many persuasion styles and levels of specificity — aimed at making your AI do or reveal what it shouldn't. These are the kinds of prompts a real bad actor would use.",
    },
    {
      num: "2",
      icon: Shield,
      title: "Your prompt is put under pressure",
      body: "Each attack is aimed at the model running your system prompt, exactly as it would behave in production. Nothing is simulated or softened — the results reflect the real risk your deployed AI carries today.",
    },
    {
      num: "3",
      icon: Gavel,
      title: "An independent Judge delivers the verdict",
      body: "A separate evaluator reviews every exchange and decides whether the protected information or behavior was compromised — with clear reasoning. This removes guesswork: a breach is a breach, not a matter of opinion.",
    },
  ];
  return (
    <section id={LandingSection.HowItWorks} className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Three AI agents, one adversarial test.
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            The Attacker probes, the Target defends, the Judge decides.
          </p>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {agents.map((a) => (
            <div
              key={a.num}
              className="group relative rounded-2xl border border-slate-200 bg-white p-8 transition-all hover:border-blue-300 hover:shadow-lg"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                  <a.icon className="h-5 w-5" />
                </div>
                <span className="text-4xl font-bold text-slate-200">
                  {a.num}
                </span>
              </div>
              <h3 className="mb-3 text-lg font-semibold text-slate-900">
                {a.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Methodology (dark) ── */
function Methodology() {
  return (
    <section className="bg-slate-950 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-400">
          What makes ToolRegistry different
        </p>
        <p className="text-xl leading-relaxed text-slate-300">
          The specific attack library, evaluation criteria, and scoring
          methodology are ToolRegistry&apos;s secret sauce. We&apos;re
          constantly refining our techniques to stay ahead of the curve, so the
          test stays effective against the latest threats.
        </p>
      </div>
    </section>
  );
}

/* ── What You Get (light) ── */
function WhatYouGet() {
  const items = [
    {
      icon: ScanSearch,
      title: "A security score",
      body: "A single, objective number that tells you how vulnerable your system prompt is to adversarial attacks — and how much time and access a real attacker would need to break through.",
    },
    {
      icon: FileBarChart,
      title: "An analysis",
      body: "A breakdown of the kinds of attacks that worked, and how they exploited your prompt's weaknesses — so you can fix the root cause, not just the symptoms.",
    },
    {
      icon: ShieldPlus,
      title: "A hardened prompt",
      body: "A rewritten, safer version of your prompt that preserves your intended behavior while blocking the most common attack vectors we found.",
    },
  ];
  return (
    <section
      id={LandingSection.WhatYouGet}
      className="bg-stone-50 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-600">
            What you get
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            A score, an analysis, and a fix.
          </h2>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-lg font-semibold text-slate-900">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Research (dark) ── */
function Research() {
  return (
    <section
      id={LandingSection.Research}
      className="bg-slate-950 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900">
          <BookOpen className="h-7 w-7 text-blue-400" />
        </div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-400">
          The research behind it
        </p>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Grounded in research.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-300">
          ToolRegistry reflects Lehigh University's mission to translate
          cutting-edge research into practical innovation. Our platform combines
          insights from behavioral science and AI security to advance safer,
          more resilient generative AI systems.
        </p>
      </div>
    </section>
  );
}

/* ── Products (dark) ── */
function Products() {
  const products = [
    {
      name: "PenTest Scan",
      desc: "Paste your system prompt, pick a target model, and launch a full adversarial sweep. Get a score, breach analysis, and a hardened prompt back in minutes.",
      icon: Target,
    },
    {
      name: "Security Insights Report",
      desc: "A detailed, trial-by-trial breakdown of every attack — what worked, what didn't, and exactly why. Exportable, shareable, and audit-ready.",
      icon: FileBarChart,
    },
  ];
  return (
    <section
      id={LandingSection.Products}
      className="bg-slate-900 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-400">
            Two products. One defense layer.
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything you need to harden your prompt.
          </h2>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-2">
          {products.map((p) => (
            <Link
              key={p.name}
              href="/login"
              className="group rounded-2xl border border-slate-700 bg-slate-950/50 p-8 transition-all hover:border-blue-500/50 hover:bg-slate-950"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/15 text-blue-400">
                <p.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">
                {p.name}
              </h3>
              <p className="mb-5 text-sm leading-relaxed text-slate-400">
                {p.desc}
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 transition-colors group-hover:text-blue-300">
                Learn more
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA (dark) ── */
function FinalCTA() {
  return (
    <section id={LandingSection.CTA} className="bg-slate-950 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600">
          <Lock className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          See how your prompt holds up.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-slate-300">
          Submit a system prompt, get a security score and breach analysis, and
          download a hardened version ready for production.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <Link href="/login">
              See how it works
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-slate-700 bg-transparent text-blue-400 hover:bg-slate-900 hover:text-blue-300"
          >
            <Link href="/login">Request an enterprise demo</Link>
          </Button>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-500">
          {[
            "No credit card required",
            "First scan in minutes",
            "SOC 2 compliant",
          ].map((item) => (
            <span key={item} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Footer ── */
function LandingFooter() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row">
        <Link href="/" className="flex items-center gap-2">
          <LogoIcon size="sm" />
          <span className="text-lg font-bold text-white">ToolRegistry</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
          <a href="#how-it-works" className="hover:text-white">
            How it works
          </a>
          <Link href="/dashboard/reports" className="hover:text-white">
            Reports
          </Link>
          {/* <a href="#research" className="hover:text-white">
            Resources
          </a> */}
          <a href="#products" className="hover:text-white">
            Docs
          </a>
          {/* <a href="#cta" className="hover:text-white">
            Reach Out
          </a> */}
        </nav>
        {/* <p className="text-xs text-slate-600">
          © 2026 ToolRegistry. All rights reserved.
        </p> */}
      </div>
    </footer>
  );
}
