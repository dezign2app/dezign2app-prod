import React from "react";
import Link from "next/link";
import { Header } from "../_landing_components/header";
import { Footer } from "../_landing_components/footer";
import type { Metadata } from "next";
import {
  Sparkles,
  Package,
  Layers,
  Cpu,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Flame,
  TrendingDown,
  Terminal,
  Code2,
  Workflow,
  Zap,
  Box,
  Braces,
  GitFork,
  Check,
  X,
} from "lucide-react";

export const metadata: Metadata = {
  title: "dpm — Dezign Package Manager | The Visual Layer for npm",
  description:
    "dpm brings visual architecture contracts, syntax-free composition, and deterministic Agentic development to npm packages. The DefinitelyTyped of visual design.",
};

export default function DpmPublicPage() {
  return (
    <div className="min-h-screen w-full bg-[#050505] text-white flex flex-col items-center overflow-x-hidden selection:bg-white/20 selection:text-white font-sans">
      <Header />

      <main className="w-full flex flex-col items-center">
        {/* Hero Section */}
        <section className="w-full max-w-5xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 flex flex-col items-center text-center">
          {/* Upcoming Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-mono mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>UPCOMING SPECIFICATION • MANIFESTO & RFC</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight font-mono text-white max-w-4xl leading-[1.1]">
            The Visual Abstraction Layer for <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">npm</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed">
            Just as TypeScript brought static typing to JavaScript (<code className="text-zinc-200 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 font-mono text-sm">@types/*</code>),{" "}
            <strong className="text-white">dpm</strong> brings visual architecture contracts, syntax-free composition, and deterministic Agentic development to npm packages.
          </p>

          <div className="mt-8 flex flex-wrap gap-3.5 justify-center">
            <Link
              href="/#studio-views"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors"
            >
              <span>Explore Visual Canvas</span>
              <ArrowRight className="size-3.5" />
            </Link>
            <a
              href="https://github.com/dezign2app/dezign2app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium hover:text-white hover:border-zinc-700 transition-colors"
            >
              <GitFork className="size-3.5" />
              <span>Contribute to RFC</span>
            </a>
          </div>

          {/* Quick Mapping Pills */}
          <div className="mt-12 w-full max-w-3xl p-4 rounded-xl bg-zinc-950/80 border border-zinc-900 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono text-left">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
              <span className="text-zinc-400">express</span>
              <span className="text-emerald-400 font-semibold">@dpm/express</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
              <span className="text-zinc-400">stripe</span>
              <span className="text-emerald-400 font-semibold">@dpm/stripe</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
              <span className="text-zinc-400">@prisma/client</span>
              <span className="text-emerald-400 font-semibold">@dpm/prisma</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
              <span className="text-zinc-400">langgraph</span>
              <span className="text-emerald-400 font-semibold">@dpm/langgraph</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
              <span className="text-zinc-400">better-auth</span>
              <span className="text-emerald-400 font-semibold">@dpm/auth</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
              <span className="text-zinc-400">redis</span>
              <span className="text-emerald-400 font-semibold">@dpm/redis</span>
            </div>
          </div>
        </section>

        {/* Section: The Breakdown */}
        <section className="w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-16 border-t border-zinc-900">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-mono uppercase tracking-widest text-amber-400 font-semibold">
              The Dual Crisis
            </h2>
            <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">
              Why Raw Code Fails Both AI Models & Human Engineers
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Machine Dilemma */}
            <div className="flex flex-col p-6 rounded-2xl bg-zinc-950/60 border border-red-500/20 relative overflow-hidden">
              <div className="flex items-center gap-2.5 text-red-400 mb-4">
                <AlertTriangle className="size-5" />
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider">
                  1. The Machine Dilemma
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                When AI coding models (Cursor, Devin, Claude) are asked to generate raw npm syntax from scratch, they hit catastrophic probabilistic walls:
              </p>

              <div className="flex flex-col gap-3.5 text-xs text-zinc-300">
                <div className="flex gap-2.5 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-white">Parameter & Syntax Hallucination:</strong> Models invent non-existent SDK parameters or use deprecated methods from older training weights.
                  </div>
                </div>
                <div className="flex gap-2.5 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-white">70% Token Burn on Boilerplate:</strong> Up to 70% of context tokens are wasted re-typing repetitive headers, imports, types, and glue syntax.
                  </div>
                </div>
                <div className="flex gap-2.5 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-white">Unoptimized, Naive Code:</strong> Models default to brute-force code: N+1 database queries, omitted connection pooling, and stream memory leaks.
                  </div>
                </div>
                <div className="flex gap-2.5 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-white">The Token Billing Spiral:</strong> A small typo requires re-generating 400 lines of code repeatedly in self-healing loops, burning thousands in LLM API bills.
                  </div>
                </div>
              </div>
            </div>

            {/* Human Dilemma */}
            <div className="flex flex-col p-6 rounded-2xl bg-zinc-950/60 border border-amber-500/20 relative overflow-hidden">
              <div className="flex items-center gap-2.5 text-amber-400 mb-4">
                <Flame className="size-5" />
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider">
                  2. The Human Dilemma
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                Even when AI produces code that compiles, it introduces an unsustainable operational crisis for human teams:
              </p>

              <div className="flex flex-col gap-3.5 text-xs text-zinc-300">
                <div className="flex gap-2.5 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-white">Review Fatigue & Rubber-Stamping:</strong> Humans cannot realistically audit 5,000 lines of AI-generated boilerplate per PR. Silent bugs slip through.
                  </div>
                </div>
                <div className="flex gap-2.5 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-white">The Black-Box Codebase:</strong> Teams lose their spatial and architectural mental model. Nobody understands how 20 AI-generated files connect.
                  </div>
                </div>
                <div className="flex gap-2.5 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-white">Debugging Code Nobody Wrote:</strong> When services crash at 2 AM, engineers are forced to reverse-engineer machine-written code with zero human intent.
                  </div>
                </div>
                <div className="flex gap-2.5 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-white">Cloud Infrastructure Billing Shock:</strong> Unoptimized code runs silently until exponential AWS or Vercel bills hit as customer traffic scales.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section: The Solution */}
        <section className="w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-16 border-t border-zinc-900">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold">
              The Paradigm Shift
            </h2>
            <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">
              From Probabilistic Syntax to Deterministic Visual Contracts
            </p>
            <p className="mt-3 text-xs sm:text-sm text-zinc-400">
              dpm replaces raw text generation with typed visual node operations. The Dezign compiler then guarantees 100% verified, production-grade output.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Without dpm */}
            <div className="p-6 rounded-xl bg-zinc-950 border border-zinc-900 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-red-400 font-mono text-xs font-bold uppercase mb-3">
                  <X className="size-4" />
                  <span>Without dpm (Raw Text Prompting)</span>
                </div>
                <div className="bg-black/90 rounded-lg p-3.5 border border-zinc-800/80 font-mono text-[11px] text-zinc-400 leading-relaxed mb-4">
                  <p className="text-zinc-500">// Developer: "Add Stripe webhook & update user"</p>
                  <p className="text-red-400 mt-1.5">AI writes 300 lines of fragile TS...</p>
                  <p className="text-zinc-500 mt-1">- Misses signature verification header</p>
                  <p className="text-zinc-500">- Forgets `npm install stripe`</p>
                  <p className="text-zinc-500">- Mismatches schema types with DB</p>
                  <p className="text-zinc-500">- 45 minutes of debugging runtime crashes</p>
                </div>
              </div>
              <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span>High token cost, unverified output, brittle runtime</span>
              </div>
            </div>

            {/* With dpm */}
            <div className="p-6 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase mb-3">
                  <Check className="size-4" />
                  <span>With dpm (Visual Contract Operations)</span>
                </div>
                <div className="bg-black/90 rounded-lg p-3.5 border border-emerald-500/20 font-mono text-[11px] text-zinc-300 leading-relaxed mb-4">
                  <p className="text-zinc-500">// Agent connects visual ports:</p>
                  <p className="text-emerald-400 mt-1.5">connect(@dpm/stripe.on_payment_success,</p>
                  <p className="text-emerald-400">        @dpm/prisma.update_user_tier)</p>
                  <p className="text-zinc-400 mt-2">✓ Schema validated at design-time</p>
                  <p className="text-zinc-400">✓ Auto-runs `npm install stripe @prisma/client`</p>
                  <p className="text-zinc-400">✓ Compiler outputs verified production monorepo</p>
                </div>
              </div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span>10 tokens consumed, 0% syntax errors, 100% auditable</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section: What dpm Packages Define */}
        <section className="w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-16 border-t border-zinc-900">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-400 font-semibold">
              The Architecture Contract
            </h2>
            <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">
              What Every @dpm Package Exposes
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-900 flex flex-col gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
                <Workflow className="size-4" />
              </div>
              <h3 className="font-mono text-sm font-semibold text-white">1. Input & Output Handles</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Visual connection points (<code className="text-zinc-300 font-mono">req_in</code>, <code className="text-zinc-300 font-mono">event_out</code>, <code className="text-zinc-300 font-mono">db_bind</code>) that define how nodes wire together.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-900 flex flex-col gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-teal-400">
                <ShieldCheck className="size-4" />
              </div>
              <h3 className="font-mono text-sm font-semibold text-white">2. Port Schemas (Zod)</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Strict data contracts. The canvas rejects incompatible wiring at design time, allowing AI agents to self-correct in milliseconds.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-900 flex flex-col gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400">
                <Braces className="size-4" />
              </div>
              <h3 className="font-mono text-sm font-semibold text-white">3. Visual Property Sidebars</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Structured forms to configure API keys, timeouts, and modes directly in the UI without editing raw configuration files.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-900 flex flex-col gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-purple-400">
                <Layers className="size-4" />
              </div>
              <h3 className="font-mono text-sm font-semibold text-white">4. Pipeline Transformers</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Reusable middleware and transform steps (signature validation, JWT checks, sanitization) ready to drop into request pipelines.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-900 flex flex-col gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-blue-400">
                <Code2 className="size-4" />
              </div>
              <h3 className="font-mono text-sm font-semibold text-white">5. Pre-Optimized Codegen</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Hardened codegen rules written by domain experts: connection pooling, automated caching, zero N+1 queries, and clean monorepo output.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-900 flex flex-col gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-rose-400">
                <TrendingDown className="size-4" />
              </div>
              <h3 className="font-mono text-sm font-semibold text-white">6. Cost & Quota Guardrails</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Explicit rate-limiters, cache nodes, and concurrency bounds prevent runaway cloud and AI token billing shocks before deployment.
              </p>
            </div>
          </div>
        </section>

        {/* Section: Dual Packaging Models */}
        <section className="w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-16 border-t border-zinc-900">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-400 font-semibold">
              Distribution
            </h2>
            <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">
              Two Ways to Ship dpm Packages
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-900 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 uppercase">
                  Model 1
                </span>
                <h3 className="text-base font-bold text-white font-mono mt-3">
                  Native Embedding (In npm package)
                </h3>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  Official npm package authors can ship a <code className="text-zinc-200 font-mono">dezign/dezign.json</code> directly inside their npm package. The Dezign canvas detects it automatically.
                </p>
                <div className="mt-4 p-3 rounded-lg bg-black/80 border border-zinc-800/80 font-mono text-[11px] text-zinc-400">
                  <p className="text-zinc-500">stripe/</p>
                  <p className="text-zinc-400">├── package.json</p>
                  <p className="text-zinc-400">└── dezign/</p>
                  <p className="text-emerald-400 font-semibold">    └── dezign.json <span className="text-zinc-500">// Visual contract</span></p>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-900 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 uppercase">
                  Model 2
                </span>
                <h3 className="text-base font-bold text-white font-mono mt-3">
                  Community Wrappers (Like @types/*)
                </h3>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  If an npm package has not added native dpm support, the community publishes a <code className="text-zinc-200 font-mono">@dpm/*</code> wrapper definition, giving any library immediate visual superpowers.
                </p>
                <div className="mt-4 p-3 rounded-lg bg-black/80 border border-zinc-800/80 font-mono text-[11px] text-zinc-400">
                  <p className="text-emerald-400 font-semibold">@dpm/express <span className="text-zinc-500">// Visual wrapper</span></p>
                  <p className="text-zinc-400">  wraps: express@^4.19.0</p>
                  <p className="text-emerald-400 font-semibold mt-1">@dpm/prisma <span className="text-zinc-500">// Visual wrapper</span></p>
                  <p className="text-zinc-400">  wraps: @prisma/client@^5.14.0</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-20 text-center flex flex-col items-center">
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-zinc-900/60 to-zinc-950 border border-zinc-800/80 w-full flex flex-col items-center">
            <h2 className="text-2xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
              Ready for the Visual Era of Software?
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-zinc-400 max-w-lg leading-relaxed">
              Join developers and architects building system design monorepos with zero glue code, zero hallucinated syntax, and verified visual contracts.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <Link
                href="/#studio-views"
                className="px-6 py-2.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors flex items-center gap-2"
              >
                <span>Launch Dezign Canvas</span>
                <ArrowRight className="size-3.5" />
              </Link>
              <Link
                href="/"
                className="px-6 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium hover:text-white transition-colors"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

